import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { inicioIntegracao, processarCobranca } from '@/lib/asaas/processar'
import { buscarCobranca, type AsaasPayment } from '@/lib/asaas/api'

// Avisos do Asaas (cadastre esta URL em Integrações → Webhooks, com o mesmo
// token de ASAAS_WEBHOOK_TOKEN). O Asaas pode mandar o mesmo aviso mais de
// uma vez: o id do evento é gravado e repetidos são ignorados.
//
// Sempre responde 200 depois de registrar o evento. Se o processamento falhar,
// o erro fica salvo e o botão "Sincronizar" na tela do Asaas corrige depois —
// responder erro faria o Asaas pausar a fila após 15 falhas.

function autorizado(req: NextRequest) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN
  const recebido = req.headers.get('asaas-access-token')
  if (!esperado || !recebido) return false
  const a = Buffer.from(esperado)
  const b = Buffer.from(recebido)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let corpo: { id?: string; event?: string; payment?: AsaasPayment }
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  if (!corpo.id || !corpo.event) return NextResponse.json({ ok: true })

  const supabase = createServiceClient() as any
  const { error: errEvento } = await supabase.from('asaas_eventos').insert({
    id: corpo.id,
    evento: corpo.event,
    payment_id: corpo.payment?.id ?? null,
    payload: corpo,
  })
  // Já recebido antes.
  if (errEvento?.code === '23505') return NextResponse.json({ ok: true, repetido: true })
  if (errEvento) {
    console.error('[asaas] gravar evento', errEvento)
    return NextResponse.json({ error: 'Falha ao registrar evento.' }, { status: 500 })
  }

  if (!corpo.event.startsWith('PAYMENT_') || !corpo.payment) {
    await supabase.from('asaas_eventos').update({ resultado: 'ignorado' }).eq('id', corpo.id)
    return NextResponse.json({ ok: true })
  }

  try {
    const inicio = await inicioIntegracao(supabase)
    if (!inicio) {
      await supabase.from('asaas_eventos').update({ resultado: 'integracao_desligada' }).eq('id', corpo.id)
      return NextResponse.json({ ok: true })
    }
    // Avisos podem chegar fora de ordem: usa sempre a situação atual da cobrança.
    const cobranca = await buscarCobranca(corpo.payment.id).catch(() => corpo.payment!)
    const r = await processarCobranca({ supabase, inicio }, cobranca, { excluida: corpo.event === 'PAYMENT_DELETED' })
    await supabase.from('asaas_eventos').update({ resultado: r.acao }).eq('id', corpo.id)
    // Só avisa no sino o que precisa de decisão; cobranças normais não enchem o sino.
    if (r.acao === 'pendencia') {
      await supabase.from('notificacoes').insert({
        usuario_id: null,
        titulo: 'Asaas: cobrança precisa de atenção',
        mensagem: `${r.cliente ?? 'Cliente não identificado'} · vencimento ${r.vencimento}${r.detalhe ? ` · ${r.detalhe}` : ''}`,
        link: '/catalogo/asaas',
        tipo: 'alerta',
        lida: false,
      })
    }
  } catch (e) {
    console.error('[asaas] processar', e)
    await supabase.from('asaas_eventos').update({ resultado: 'erro', erro: e instanceof Error ? e.message : String(e) }).eq('id', corpo.id)
  }
  return NextResponse.json({ ok: true })
}

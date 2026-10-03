import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buscarCobranca } from '@/lib/asaas/api'
import { usuarioLogado } from '@/lib/asaas/auth'
import { inicioIntegracao, processarCobranca } from '@/lib/asaas/processar'

// Resolve uma pendência da tela do Asaas.
// Corpo: { paymentId, clienteId?, lancamentoId?, ignorar? }
//   clienteId    → liga o cliente do Asaas a este cliente e processa de novo
//   lancamentoId → liga a cobrança a este lançamento (quando havia vários no mês)
//   ignorar      → só marca a pendência como resolvida
export async function POST(req: NextRequest) {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const corpo = (await req.json().catch(() => ({}))) as { paymentId?: string; clienteId?: string; lancamentoId?: string; ignorar?: boolean }
  if (!corpo.paymentId) return NextResponse.json({ error: 'paymentId obrigatório.' }, { status: 400 })

  const supabase = createServiceClient() as any
  const marcarResolvida = () =>
    supabase.from('asaas_pendencias').update({ resolvida: true, updated_at: new Date().toISOString() }).eq('payment_id', corpo.paymentId)

  try {
    if (corpo.ignorar) {
      await marcarResolvida()
      return NextResponse.json({ ok: true })
    }
    const cobranca = await buscarCobranca(corpo.paymentId)
    if (corpo.clienteId) {
      const { error } = await supabase.from('clientes').update({ asaas_customer_id: cobranca.customer }).eq('id', corpo.clienteId)
      if (error) {
        return NextResponse.json({ error: error.code === '23505' ? 'Esse cliente do Asaas já está ligado a outro cliente.' : error.message }, { status: 400 })
      }
    }
    const inicio = (await inicioIntegracao(supabase)) ?? cobranca.dueDate
    const r = await processarCobranca({ supabase, inicio }, cobranca, { lancamentoEscolhido: corpo.lancamentoId })
    if (r.acao !== 'pendencia') await marcarResolvida()
    return NextResponse.json({ ok: true, resultado: r })
  } catch (e) {
    console.error('[asaas] reprocessar', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao reprocessar.' }, { status: 502 })
  }
}

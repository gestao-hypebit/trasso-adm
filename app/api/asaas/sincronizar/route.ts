import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { asaasConfigurado, listarCobrancas } from '@/lib/asaas/api'
import { usuarioLogado } from '@/lib/asaas/auth'
import { inicioIntegracao, processarCobranca, type Resultado } from '@/lib/asaas/processar'

// Busca no Asaas as cobranças com vencimento a partir da data de início e
// passa cada uma pela mesma lógica do webhook. Pode rodar quantas vezes quiser:
// nada é duplicado.
//
// Corpo: { simular?: boolean, inicio?: 'YYYY-MM-DD' }
//   simular=true → só calcula a prévia, não grava nada.
//   inicio       → usado na prévia antes de ativar; ao sincronizar de verdade
//                  vale a data salva na configuração.
export async function POST(req: NextRequest) {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!asaasConfigurado()) return NextResponse.json({ error: 'ASAAS_API_KEY não configurada no servidor.' }, { status: 400 })

  const corpo = (await req.json().catch(() => ({}))) as { simular?: boolean; inicio?: string }
  const supabase = createServiceClient() as any
  const salvo = await inicioIntegracao(supabase)
  const inicio = corpo.simular ? corpo.inicio ?? salvo : salvo
  if (!inicio || !/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
    return NextResponse.json({ error: 'Defina a data de início da integração.' }, { status: 400 })
  }

  try {
    const cobrancas = await listarCobrancas(inicio)
    const ctx = { supabase, inicio, simular: !!corpo.simular }
    const resultados: Resultado[] = []
    const erros: { paymentId: string; erro: string }[] = []
    for (const c of cobrancas) {
      try {
        resultados.push(await processarCobranca(ctx, c))
      } catch (e) {
        erros.push({ paymentId: c.id, erro: e instanceof Error ? e.message : String(e) })
      }
    }
    const conta = (acao: string) => resultados.filter((r) => r.acao === acao).length
    return NextResponse.json({
      inicio,
      total: cobrancas.length,
      resumo: { ligado: conta('ligado'), criado: conta('criado'), atualizado: conta('atualizado'), pendencia: conta('pendencia'), ignorado: conta('ignorado'), erro: erros.length },
      resultados: resultados.sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
      erros,
    })
  } catch (e) {
    console.error('[asaas] sincronizar', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao falar com o Asaas.' }, { status: 502 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  AsaasErro, asaasConfigurado, atualizarAssinatura, buscarCobranca, cancelarAssinatura, cobrancasDaAssinatura,
  type AsaasPayment,
} from '@/lib/asaas/api'
import { usuarioLogado } from '@/lib/asaas/auth'
import { refletirNoSistema } from '@/lib/asaas/processar'

// Ações numa assinatura do Asaas (painel do assinante no Catálogo Place).
//   POST { valor?, proximoVencimento?, formaPagamento?, atualizarAbertas? } → altera
//   DELETE                                                                → cancela
// As faturas em aberto afetadas são refletidas no financeiro na hora.

const FORMAS = ['PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED']

function erro(e: unknown) {
  console.error('[asaas] assinatura', e)
  const msg = e instanceof AsaasErro ? e.descricao : e instanceof Error ? e.message : 'Falha ao falar com o Asaas.'
  return NextResponse.json({ error: msg }, { status: e instanceof AsaasErro && e.status < 500 ? 400 : 502 })
}

async function preparar() {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!asaasConfigurado()) return NextResponse.json({ error: 'ASAAS_API_KEY não configurada no servidor.' }, { status: 400 })
  return null
}

// Faturas ainda não pagas (aguardando ou vencidas) da assinatura.
async function abertas(id: string) {
  const [pendentes, vencidas] = await Promise.all([cobrancasDaAssinatura(id, 'PENDING'), cobrancasDaAssinatura(id, 'OVERDUE')])
  return [...pendentes, ...vencidas]
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await preparar()
  if (bloqueio) return bloqueio
  const { id } = await params
  const corpo = (await req.json().catch(() => ({}))) as {
    valor?: unknown; proximoVencimento?: unknown; formaPagamento?: unknown; atualizarAbertas?: unknown
  }

  const dados: { value?: number; nextDueDate?: string; billingType?: string; updatePendingPayments: boolean } = {
    updatePendingPayments: corpo.atualizarAbertas !== false,
  }
  if (corpo.valor !== undefined) {
    if (typeof corpo.valor !== 'number' || !Number.isFinite(corpo.valor) || corpo.valor <= 0) return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })
    dados.value = corpo.valor
  }
  if (corpo.proximoVencimento !== undefined) {
    if (typeof corpo.proximoVencimento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(corpo.proximoVencimento)) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })
    dados.nextDueDate = corpo.proximoVencimento
  }
  if (corpo.formaPagamento !== undefined) {
    if (typeof corpo.formaPagamento !== 'string' || !FORMAS.includes(corpo.formaPagamento)) return NextResponse.json({ error: 'Forma de pagamento inválida.' }, { status: 400 })
    dados.billingType = corpo.formaPagamento
  }
  if (dados.value === undefined && dados.nextDueDate === undefined && dados.billingType === undefined) {
    return NextResponse.json({ error: 'Nada para alterar.' }, { status: 400 })
  }

  try {
    await atualizarAssinatura(id, dados)
    if (dados.updatePendingPayments) await refletirNoSistema(createServiceClient(), await abertas(id))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return erro(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await preparar()
  if (bloqueio) return bloqueio
  const { id } = await params
  try {
    // Ao cancelar, o Asaas remove as faturas em aberto da assinatura:
    // guarda quais eram para refletir no financeiro depois.
    const antes = await abertas(id)
    await cancelarAssinatura(id)
    const removidas: AsaasPayment[] = []
    const mantidas: AsaasPayment[] = []
    for (const c of antes) {
      const agora = await buscarCobranca(c.id).catch(() => null)
      if (!agora || agora.deleted) removidas.push(c)
      else mantidas.push(agora)
    }
    const supabase = createServiceClient()
    await refletirNoSistema(supabase, removidas, { excluida: true })
    await refletirNoSistema(supabase, mantidas)
    return NextResponse.json({ ok: true, faturasRemovidas: removidas.length })
  } catch (e) {
    return erro(e)
  }
}

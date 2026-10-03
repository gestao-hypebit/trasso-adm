import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AsaasErro, asaasConfigurado, atualizarCobranca, buscarCobranca, excluirCobranca, receberEmDinheiro } from '@/lib/asaas/api'
import { usuarioLogado } from '@/lib/asaas/auth'
import { refletirNoSistema } from '@/lib/asaas/processar'

// Ações numa fatura do Asaas (painel do assinante no Catálogo Place).
//   POST { acao: 'vencimento', vencimento, valor? }  → nova data (2ª via)
//   POST { acao: 'recebida', data, valor }           → recebida fora do Asaas
//   DELETE                                           → cancela a fatura
// Depois de cada ação o lançamento do financeiro é atualizado na hora.

const dataValida = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const valorValido = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

function erro(e: unknown) {
  console.error('[asaas] cobranca', e)
  const msg = e instanceof AsaasErro ? e.descricao : e instanceof Error ? e.message : 'Falha ao falar com o Asaas.'
  return NextResponse.json({ error: msg }, { status: e instanceof AsaasErro && e.status < 500 ? 400 : 502 })
}

async function preparar() {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!asaasConfigurado()) return NextResponse.json({ error: 'ASAAS_API_KEY não configurada no servidor.' }, { status: 400 })
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await preparar()
  if (bloqueio) return bloqueio
  const { id } = await params
  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; vencimento?: unknown; data?: unknown; valor?: unknown }

  try {
    const atual = await buscarCobranca(id)
    let nova
    if (corpo.acao === 'vencimento') {
      if (!dataValida(corpo.vencimento)) return NextResponse.json({ error: 'Data de vencimento inválida.' }, { status: 400 })
      if (corpo.valor !== undefined && !valorValido(corpo.valor)) return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })
      nova = await atualizarCobranca(id, {
        dueDate: corpo.vencimento,
        value: (corpo.valor as number | undefined) ?? Number(atual.value),
        billingType: atual.billingType,
      })
    } else if (corpo.acao === 'recebida') {
      if (!dataValida(corpo.data)) return NextResponse.json({ error: 'Data de pagamento inválida.' }, { status: 400 })
      if (!valorValido(corpo.valor)) return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })
      nova = await receberEmDinheiro(id, { paymentDate: corpo.data, value: corpo.valor })
    } else {
      return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
    }
    await refletirNoSistema(createServiceClient(), [nova])
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
    const atual = await buscarCobranca(id)
    await excluirCobranca(id)
    await refletirNoSistema(createServiceClient(), [atual], { excluida: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return erro(e)
  }
}

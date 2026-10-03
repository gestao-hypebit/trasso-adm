import { NextRequest, NextResponse } from 'next/server'
import { asaasConfigurado, cobrancasDoCliente } from '@/lib/asaas/api'
import { usuarioLogado } from '@/lib/asaas/auth'

// Faturas de um cliente do Asaas, direto da API (sempre a situação atual).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!asaasConfigurado()) return NextResponse.json({ error: 'ASAAS_API_KEY não configurada no servidor.' }, { status: 400 })

  const { customerId } = await params
  try {
    const cobrancas = await cobrancasDoCliente(customerId)
    return NextResponse.json({
      cobrancas: cobrancas
        .filter((c) => !c.deleted)
        .map((c) => ({
          id: c.id,
          assinaturaId: c.subscription,
          valor: Number(c.value),
          valorLiquido: c.netValue != null ? Number(c.netValue) : null,
          vencimento: c.dueDate,
          pagoEm: c.clientPaymentDate ?? c.paymentDate,
          status: c.status,
          formaPagamento: c.billingType,
          descricao: c.description,
          faturaUrl: c.invoiceUrl,
          boletoUrl: c.bankSlipUrl ?? null,
          numero: c.invoiceNumber ?? null,
        })),
    })
  } catch (e) {
    console.error('[asaas] cobrancas do cliente', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao falar com o Asaas.' }, { status: 502 })
  }
}

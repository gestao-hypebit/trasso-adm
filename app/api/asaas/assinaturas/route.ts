import { NextResponse } from 'next/server'
import { asaasConfigurado, listarAssinaturas, listarClientesAsaas, listarCobrancasPorStatus } from '@/lib/asaas/api'
import { usuarioLogado } from '@/lib/asaas/auth'

// Assinaturas do Asaas com o nome/contato do cliente de cada uma.
// A tela do Catálogo Place liga cada assinatura ao cliente do sistema
// pelo clientes.asaas_customer_id.
export async function GET() {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!asaasConfigurado()) return NextResponse.json({ configurado: false, assinaturas: [] })

  try {
    const [assinaturas, clientes, aguardando, vencidas] = await Promise.all([
      listarAssinaturas(), listarClientesAsaas(), listarCobrancasPorStatus('PENDING'), listarCobrancasPorStatus('OVERDUE'),
    ])
    const porId = new Map(clientes.map((c) => [c.id, c]))
    // Fatura aguardando pagamento mais próxima de cada assinatura.
    const proximaAberta = new Map<string, string>()
    for (const p of aguardando) {
      if (!p.subscription || p.deleted) continue
      const atual = proximaAberta.get(p.subscription)
      if (!atual || p.dueDate < atual) proximaAberta.set(p.subscription, p.dueDate)
    }
    const qtdVencidas = new Map<string, number>()
    for (const p of vencidas) {
      if (!p.subscription || p.deleted) continue
      qtdVencidas.set(p.subscription, (qtdVencidas.get(p.subscription) ?? 0) + 1)
    }
    return NextResponse.json({
      configurado: true,
      assinaturas: assinaturas
        .filter((a) => !a.deleted)
        .map((a) => {
          const c = porId.get(a.customer)
          return {
            id: a.id,
            customerId: a.customer,
            customerNome: c?.name ?? null,
            customerEmail: c?.email ?? null,
            customerTelefone: c?.mobilePhone || c?.phone || null,
            valor: Number(a.value),
            ciclo: a.cycle,
            proximoVencimento: a.nextDueDate,
            proximaCobranca: proximaAberta.get(a.id) ?? a.nextDueDate,
            vencidas: qtdVencidas.get(a.id) ?? 0,
            formaPagamento: a.billingType,
            descricao: a.description,
            criadaEm: a.dateCreated,
            status: a.status,
          }
        }),
    })
  } catch (e) {
    console.error('[asaas] assinaturas', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao falar com o Asaas.' }, { status: 502 })
  }
}

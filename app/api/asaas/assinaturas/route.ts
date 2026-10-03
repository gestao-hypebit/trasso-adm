import { NextResponse } from 'next/server'
import { asaasConfigurado, listarAssinaturas, listarClientesAsaas } from '@/lib/asaas/api'
import { usuarioLogado } from '@/lib/asaas/auth'

// Assinaturas do Asaas com o nome/contato do cliente de cada uma.
// A tela do Catálogo Place liga cada assinatura ao cliente do sistema
// pelo clientes.asaas_customer_id.
export async function GET() {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!asaasConfigurado()) return NextResponse.json({ configurado: false, assinaturas: [] })

  try {
    const [assinaturas, clientes] = await Promise.all([listarAssinaturas(), listarClientesAsaas()])
    const porId = new Map(clientes.map((c) => [c.id, c]))
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

import 'server-only'
import { asaasConfigurado, listarAssinaturas, listarClientesAsaas, listarCobrancas } from '@/lib/asaas/api'
import { valorMensal } from '@/lib/asaas/rotulos'
import { proximoPasso, type MarcasRegistro } from '@/lib/automacoes/regras'
import { ehLinhaSaas } from '@/lib/financeiro/linhas'
import { artigoLinha, faturasDasLinhas, linhaDaAssinatura, linhaSemCliente, nomeLinha, type LinhaRec } from '@/lib/recorrencia'
import { addMonthsISO, formatCurrency, toISODateLocal } from '@/lib/utils'

// Acompanha as assinaturas do Asaas e, sem ninguém digitar nada:
//   - 1º pagamento de um SaaS (Catálogo, Clubelly) → "cliente novo" nas Metas;
//   - cancelamento depois de ter sido cliente → "cancelamento" nas Metas + aviso no sino;
//   - 1º pagamento de quem não tem cadastro → aviso para criar o cliente.
// Roda no cron diário e logo depois dos avisos do Asaas (webhook). Pode rodar
// quantas vezes quiser: cada coisa é registrada uma vez só (asaas_assinaturas_registro).

type Registro = MarcasRegistro & { subscription_id: string }

const PAGO = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']

export type ResultadoAssinaturas = {
  acompanhadas: number
  novos: string[]
  cancelamentos: string[]
  semCadastro: string[]
  pulado?: string
}

export async function acompanharAssinaturas(supabase: any): Promise<ResultadoAssinaturas> {
  const resultado: ResultadoAssinaturas = { acompanhadas: 0, novos: [], cancelamentos: [], semCadastro: [] }
  if (!asaasConfigurado()) return { ...resultado, pulado: 'Asaas não configurado' }

  const { data: registros, error } = await supabase.from('asaas_assinaturas_registro').select('subscription_id, novo_registrado, cancelamento_registrado')
  if (error) return { ...resultado, pulado: 'Rode a migration 20261024000000_automacoes.sql' }
  const porId = new Map<string, Registro>((registros ?? []).map((r: Registro) => [r.subscription_id, r]))
  const primeiraExecucao = porId.size === 0

  const hoje = toISODateLocal(new Date())
  const doisMesesAtras = addMonthsISO(hoje, -2)
  const [assinaturas, clientesAsaas, recentes, { data: clientes }, { data: lancs }] = await Promise.all([
    listarAssinaturas(),
    listarClientesAsaas(),
    listarCobrancas(doisMesesAtras),
    supabase.from('clientes').select('id, nome, tipo, asaas_customer_id, produto:produtos(nome)').not('asaas_customer_id', 'is', null),
    supabase.from('lancamentos').select('frente, asaas_payment_id').not('asaas_payment_id', 'is', null),
  ])
  const faturas = faturasDasLinhas(lancs ?? [])
  const clientePorCustomer = new Map<string, { id: string; nome: string; tipo: string; produto: { nome: string } | null }>(
    (clientes ?? []).map((c: any) => [c.asaas_customer_id, c]))
  const nomeAsaas = new Map(clientesAsaas.map((c) => [c.id, c.name]))

  // Cobranças recentes de cada assinatura e a data do 1º pagamento entre elas.
  const cobrancasDa = new Map<string, string[]>()
  const primeiroPagamento = new Map<string, string>()
  for (const p of recentes) {
    if (!p.subscription || p.deleted) continue
    cobrancasDa.set(p.subscription, [...(cobrancasDa.get(p.subscription) ?? []), p.id])
    if (!PAGO.includes(p.status)) continue
    const quando = (p.clientPaymentDate ?? p.paymentDate ?? p.dueDate).slice(0, 10)
    const atual = primeiroPagamento.get(p.subscription)
    if (!atual || quando < atual) primeiroPagamento.set(p.subscription, quando)
  }

  const avisos: { titulo: string; mensagem: string; tipo: string; link: string }[] = []
  const gravar: Record<string, unknown>[] = []

  for (const s of assinaturas) {
    const cliente = clientePorCustomer.get(s.customer) ?? null
    const resumo = { cobrancasRecentes: cobrancasDa.get(s.id) ?? [], descricao: s.description }
    const linha: LinhaRec = cliente ? linhaDaAssinatura(resumo, cliente, faturas) : linhaSemCliente(resumo)
    const nome = (cliente?.nome ?? nomeAsaas.get(s.customer) ?? 'Cliente do Asaas').trim()
    const mensal = valorMensal({ valor: Number(s.value), ciclo: s.cycle })
    const anterior = porId.get(s.id) ?? null
    const passo = proximoPasso(anterior, {
      pagou: primeiroPagamento.has(s.id),
      cancelada: !!s.deleted || s.status !== 'ACTIVE',
      criadaEm: s.dateCreated.slice(0, 10),
    }, { primeiraExecucao, antigaAntesDe: doisMesesAtras })
    resultado.acompanhadas++

    const rotulo = `${nome} (${nomeLinha[linha]}, ${formatCurrency(mensal)}/mês)`
    if (passo.novo) {
      if (!cliente) {
        resultado.semCadastro.push(nome)
        avisos.push({
          titulo: `${nome} pagou a 1ª fatura e não tem cadastro`,
          mensagem: `Assinatura ${artigoLinha(linha)} ${nomeLinha[linha]} de ${formatCurrency(mensal)}/mês. Crie o cliente com os dados do Asaas na lista "Só no Asaas".`,
          tipo: 'alerta',
          link: `/financeiro/mrr?aba=${abaDaLinha(linha)}`,
        })
      } else {
        resultado.novos.push(rotulo)
        avisos.push({
          titulo: `Novo assinante: ${nome}`,
          mensagem: ehLinhaSaas(linha)
            ? `${nomeLinha[linha]} · ${formatCurrency(mensal)}/mês. Já entrou nas Metas: complete o canal de aquisição.`
            : `${nomeLinha[linha]} · ${formatCurrency(mensal)}/mês.`,
          tipo: 'sucesso',
          link: ehLinhaSaas(linha) ? '/metas' : `/financeiro/mrr?aba=${abaDaLinha(linha)}`,
        })
      }
      if (ehLinhaSaas(linha)) await registrarMovimentacao(supabase, 'novo', s.id, nome, linha, mensal, primeiroPagamento.get(s.id)!)
    }
    if (passo.cancelamento) {
      resultado.cancelamentos.push(rotulo)
      avisos.push({
        titulo: `Assinatura cancelada: ${nome}`,
        mensagem: `${nomeLinha[linha]} · ${formatCurrency(mensal)}/mês.${ehLinhaSaas(linha) ? ' Registrado nas Metas: anote o motivo.' : ''} Ainda dá tempo de tentar reter.`,
        tipo: 'alerta',
        link: ehLinhaSaas(linha) ? '/metas' : `/financeiro/mrr?aba=${abaDaLinha(linha)}`,
      })
      if (ehLinhaSaas(linha)) await registrarMovimentacao(supabase, 'cancelamento', s.id, nome, linha, mensal, hoje)
    }

    const mudou = !anterior
      || anterior.novo_registrado !== passo.registro.novo_registrado
      || anterior.cancelamento_registrado !== passo.registro.cancelamento_registrado
    if (mudou) {
      gravar.push({
        subscription_id: s.id, customer_id: s.customer, linha, nome, valor: mensal,
        primeiro_pagamento: primeiroPagamento.get(s.id) ?? null,
        ...passo.registro,
        ...(passo.cancelamento || (passo.registro.cancelamento_registrado && !anterior?.cancelamento_registrado) ? { cancelado_em: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
    }
  }

  if (gravar.length) {
    const { error: e } = await supabase.from('asaas_assinaturas_registro').upsert(gravar)
    if (e) throw e
  }
  if (avisos.length) await supabase.from('notificacoes').insert(avisos.map((a) => ({ ...a, usuario_id: null })))
  return resultado
}

const abaDaLinha = (l: LinhaRec) => ({ catalogo_place: 'catalogo', clubelly: 'clubelly', agencia: 'servicos' })[l]

// Lança nas Metas, a não ser que já tenha sido lançado à mão (mesmo cliente,
// frente e tipo no mesmo mês) ou por esta mesma assinatura.
async function registrarMovimentacao(
  supabase: any, tipo: 'novo' | 'cancelamento', subscriptionId: string, nome: string, frente: string, valor: number, data: string,
) {
  const mes = data.slice(0, 7)
  const { data: existentes } = await supabase.from('metas_movimentacoes')
    .select('id, cliente_nome, asaas_subscription_id')
    .eq('tipo', tipo).eq('frente', frente)
    .gte('data', `${mes}-01`).lt('data', addMonthsISO(`${mes}-01`, 1))
  const mesmoNome = (n: string) => n.trim().toLowerCase() === nome.toLowerCase()
  if ((existentes ?? []).some((m: { cliente_nome: string; asaas_subscription_id: string | null }) =>
    m.asaas_subscription_id === subscriptionId || mesmoNome(m.cliente_nome))) return
  await supabase.from('metas_movimentacoes').insert({
    data, cliente_nome: nome, frente, tipo, canal: null, valor,
    observacoes: 'Registrado automaticamente pelo Asaas.',
    origem: 'asaas', asaas_subscription_id: subscriptionId,
  })
}

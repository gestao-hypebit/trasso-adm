// Receita recorrente (MRR) de cada linha de receita: Catálogo Place e Serviços.
//
// Fonte do valor de cada cliente:
//   - tem assinatura da linha no Asaas → valor cobrado (bruto), convertido para
//     mensal; cancelou no Asaas = saiu;
//   - senão → mensalidades lançadas no financeiro (categorias marcadas como
//     recorrentes), como sempre foi.
// O MRR líquido vem sempre dos lançamentos (o que cai na conta, sem taxas).

import { calcularMrr, type LancamentoMrr } from '@/lib/mrr'
import { diasEntre } from '@/lib/financeiro'
import { formatCurrency } from '@/lib/utils'
import { cicloLabel, valorMensal, type AssinaturaAsaas } from '@/lib/asaas/rotulos'

export type LinhaRec = 'catalogo_place' | 'agencia'

export const nomeLinha: Record<LinhaRec, string> = { catalogo_place: 'Catálogo Place', agencia: 'Serviços' }

export type ClienteRec = {
  id: string; nome: string; empresa: string | null; whatsapp: string | null; telefone: string | null
  status: string; created_at: string; tipo: string; asaas_customer_id?: string | null
}

export type LancRec = LancamentoMrr & { categoria_id: string | null; asaas_payment_id?: string | null; frente: string }

export type Assinante = {
  chave: string
  clienteId: string | null
  nome: string
  empresa: string | null
  whatsapp: string | null
  mensalidade: number
  desde: string | null
  mesesPagos: number
  pagoEsteMes: boolean
  ativo: boolean
  atraso: number
  diasAtraso: number
  status: string | null
  asaasCustomerId: string | null
  assinaturas: AssinaturaAsaas[]
  // Quais dessas assinaturas são desta linha (o cliente pode ter da outra também).
  idsDaLinha: string[]
  // De onde vêm a mensalidade e a situação: assinatura do Asaas ou lançamentos do financeiro.
  fonte: 'asaas' | 'financeiro'
  // Lançamentos desta linha no financeiro (usado quando o cliente não está no Asaas).
  historico: { data: string; valor: number; status: string; descricao: string }[]
  // Assinatura do Asaas sem cliente do sistema ligado a ela.
  soNoAsaas: boolean
  // Assinatura desta linha cancelada no Asaas (nenhuma ativa) depois de ter tido pagamento.
  cancelada: boolean
  pagamentos: number
  ultimoPagamento: string | null
}

export type AbaLista = 'ativos' | 'aguardando' | 'atraso' | 'canceladas' | 'sem_mensalidade' | 'so_asaas' | 'todos'

export type Dados = {
  clientes: ClienteRec[]
  lancamentos: LancRec[]
  recorrentes: string[]
  assinaturas: AssinaturaAsaas[]
  asaasCarregado: boolean
  hoje: string
}

export const ativa = (s: AssinaturaAsaas) => s.status === 'ACTIVE'

// Uma assinatura do Asaas é do Catálogo quando:
//   - o cliente é do tipo "saas" (só tem Catálogo); ou
//   - alguma fatura dela está ligada a um lançamento do Catálogo no financeiro; ou
//   - a descrição dela fala em "Catálogo".
// Senão, é de Serviços.
const CATALOGO_RE = /cat[aá]logo/i
export function linhaDaAssinatura(s: AssinaturaAsaas, tipoCliente: string, faturasCatalogo: Set<string>): LinhaRec {
  const catalogo = tipoCliente === 'saas' || s.cobrancasRecentes.some((id) => faturasCatalogo.has(id)) || CATALOGO_RE.test(s.descricao ?? '')
  return catalogo ? 'catalogo_place' : 'agencia'
}

export const faturasDoCatalogo = (lancamentos: LancRec[]) =>
  new Set(lancamentos.filter((l) => l.frente === 'catalogo_place' && l.asaas_payment_id).map((l) => l.asaas_payment_id!))

// Assinaturas do Asaas de clientes que não estão ligados a ninguém no sistema
// (as removidas ficam de fora: não há o que ligar).
export function assinaturasSemCliente(dados: Dados) {
  const ligados = new Set(dados.clientes.map((c) => c.asaas_customer_id).filter(Boolean))
  return dados.assinaturas.filter((s) => !s.removida && !ligados.has(s.customerId))
}

export function montarLinha(linha: LinhaRec, dados: Dados) {
  const { clientes, assinaturas, asaasCarregado, hoje } = dados
  const daLinha = dados.lancamentos.filter((l) => l.frente === linha)
  const recorrente = (l: LancRec) => !!l.categoria_id && dados.recorrentes.includes(l.categoria_id)
  const mensalidades = daLinha.filter(recorrente)
  const mrr = calcularMrr(mensalidades, hoje)
  const faturasCatalogo = faturasDoCatalogo(dados.lancamentos)

  // Assinaturas do cliente: as desta linha primeiro, ativas antes das canceladas.
  const assinaturasDo = (c: ClienteRec) => {
    if (!c.asaas_customer_id) return { todas: [] as AssinaturaAsaas[], daLinha: [] as AssinaturaAsaas[] }
    const ehDaLinha = (s: AssinaturaAsaas) => linhaDaAssinatura(s, c.tipo, faturasCatalogo) === linha
    const peso = (s: AssinaturaAsaas) => Number(ehDaLinha(s)) * 2 + Number(ativa(s))
    const todas = assinaturas.filter((s) => s.customerId === c.asaas_customer_id).sort((a, b) => peso(b) - peso(a))
    return { todas, daLinha: todas.filter(ehDaLinha) }
  }

  // Quem aparece na lista desta linha.
  //   Catálogo: todo cliente do Catálogo (sem mensalidade = cancelou ou falta lançar)
  //             + quem tem lançamento do Catálogo mesmo cadastrado com outro tipo.
  //   Serviços: só quem tem (ou teve) mensalidade de serviço ou assinatura de serviço;
  //             cliente só de projeto não entra.
  const comLancamento = new Set((linha === 'catalogo_place' ? daLinha : mensalidades).map((l) => l.cliente_id).filter(Boolean))
  const base = clientes.filter((c) => {
    if (comLancamento.has(c.id)) return true
    if (linha === 'catalogo_place') return c.tipo === 'saas' || c.tipo === 'ambos'
    return c.tipo !== 'saas' && assinaturasDo(c).daLinha.length > 0
  })

  // Em atraso: no Catálogo, qualquer receita vencida; em Serviços, só mensalidades
  // (parcela de projeto atrasada não é inadimplência de assinatura).
  const paraAtraso = linha === 'catalogo_place' ? daLinha : mensalidades
  const atrasoPorCliente = new Map<string, { valor: number; maisAntigo: string }>()
  for (const l of paraAtraso) {
    if (!l.cliente_id || l.status !== 'pendente' || l.data >= hoje) continue
    const a = atrasoPorCliente.get(l.cliente_id) ?? { valor: 0, maisAntigo: l.data }
    a.valor += Number(l.valor)
    if (l.data < a.maisAntigo) a.maisAntigo = l.data
    atrasoPorCliente.set(l.cliente_id, a)
  }
  const historicoPorCliente = new Map<string, Assinante['historico']>()
  for (const l of daLinha) {
    if (!l.cliente_id) continue
    historicoPorCliente.set(l.cliente_id, [...(historicoPorCliente.get(l.cliente_id) ?? []), { data: l.data, valor: Number(l.valor), status: l.status, descricao: l.descricao }])
  }
  const historico = (id: string) => (historicoPorCliente.get(id) ?? []).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 24)
  const pagos = (id: string) => (historicoPorCliente.get(id) ?? []).filter((h) => h.status === 'recebido')

  const ativosPorChave = new Map(mrr.ativos.map((a) => [a.chave, a]))
  const linhas: Assinante[] = base.map((c) => {
    const a = ativosPorChave.get(c.id)
    const atraso = atrasoPorCliente.get(c.id)
    const subs = assinaturasDo(c)
    // As removidas não decidem a fonte: o cliente pode ter saído do Asaas e seguir pagando por fora.
    const peloAsaas = asaasCarregado && subs.daLinha.some((s) => !s.removida)
    const ativas = subs.daLinha.filter(ativa)
    const pagamentos = pagos(c.id)
    return {
      chave: c.id, clienteId: c.id, nome: c.nome.trim(), empresa: c.empresa, whatsapp: c.whatsapp ?? c.telefone,
      mensalidade: peloAsaas ? ativas.reduce((t, s) => t + valorMensal(s), 0) : a?.valorMensal ?? 0,
      desde: a?.desde ?? null, mesesPagos: a?.mesesPagos ?? 0,
      pagoEsteMes: a?.pagoEsteMes ?? false, ativo: peloAsaas ? ativas.length > 0 : !!a,
      atraso: atraso?.valor ?? 0, diasAtraso: atraso ? diasEntre(atraso.maisAntigo, hoje) : 0, status: c.status,
      asaasCustomerId: c.asaas_customer_id ?? null, assinaturas: subs.todas, idsDaLinha: subs.daLinha.map((s) => s.id),
      fonte: peloAsaas ? 'asaas' : 'financeiro',
      historico: historico(c.id), soNoAsaas: false,
      cancelada: asaasCarregado && subs.daLinha.length > 0 && ativas.length === 0 && pagamentos.length > 0,
      pagamentos: pagamentos.length,
      ultimoPagamento: pagamentos.reduce<string | null>((m, h) => (!m || h.data > m ? h.data : m), null),
    }
  })
  // Mensalidades lançadas sem cliente vinculado (identificadas pela descrição).
  for (const a of mrr.ativos) {
    if (base.some((c) => c.id === a.chave)) continue
    linhas.push({
      chave: a.chave, clienteId: a.chave.startsWith('d:') ? null : a.chave, nome: a.nome, empresa: null, whatsapp: a.whatsapp,
      mensalidade: a.valorMensal, desde: a.desde, mesesPagos: a.mesesPagos, pagoEsteMes: a.pagoEsteMes, ativo: true,
      atraso: 0, diasAtraso: 0, status: null, asaasCustomerId: null, assinaturas: [], idsDaLinha: [], fonte: 'financeiro',
      historico: [], soNoAsaas: false, cancelada: false, pagamentos: a.mesesPagos, ultimoPagamento: null,
    })
  }
  // Assinaturas do Asaas sem cliente ligado: não dá para saber a linha. Aparecem
  // na lista do Catálogo (onde está a maioria) para você ligar ao cliente certo.
  const semCliente = new Map<string, AssinaturaAsaas[]>()
  for (const s of assinaturasSemCliente(dados)) semCliente.set(s.customerId, [...(semCliente.get(s.customerId) ?? []), s])
  if (linha === 'catalogo_place') {
    for (const [customerId, subs] of semCliente) {
      const s0 = subs[0]
      linhas.push({
        chave: `a:${customerId}`, clienteId: null, nome: s0.customerNome ?? 'Cliente do Asaas', empresa: s0.customerEmail,
        whatsapp: s0.customerTelefone,
        mensalidade: subs.filter(ativa).reduce((t, s) => t + valorMensal(s), 0), desde: null, mesesPagos: 0,
        pagoEsteMes: false, ativo: subs.some(ativa), atraso: 0, diasAtraso: 0, status: null,
        asaasCustomerId: customerId, assinaturas: subs.sort((a, b) => Number(ativa(b)) - Number(ativa(a))),
        idsDaLinha: subs.map((s) => s.id), fonte: 'asaas', historico: [], soNoAsaas: true,
        cancelada: false, pagamentos: 0, ultimoPagamento: null,
      })
    }
  }

  const doSistema = linhas.filter((l) => !l.soNoAsaas)
  const emAtraso = doSistema.filter((l) => l.atraso > 0)
  const ativas = doSistema.filter((l) => l.ativo)
  const mrrBruto = ativas.reduce((t, l) => t + l.mensalidade, 0)
  return {
    linha,
    mrr, // calculado pelos lançamentos (líquido, histórico, novos/churn)
    linhas,
    mrrBruto,
    viaAsaas: ativas.filter((l) => l.fonte === 'asaas').length,
    viaFinanceiro: ativas.filter((l) => l.fonte === 'financeiro').length,
    totalAtraso: emAtraso.reduce((s, l) => s + l.atraso, 0),
    // Assinaturas = quem tem mensalidade recente ou está devendo.
    totalAssinaturas: doSistema.filter((l) => l.ativo || l.atraso > 0).length,
    ativas: ativas.length,
    inadimplentes: emAtraso.length,
    contagem: {
      ativos: ativas.length,
      aguardando: doSistema.filter((l) => l.ativo && !l.pagoEsteMes).length,
      atraso: emAtraso.length,
      canceladas: doSistema.filter((l) => l.cancelada).length,
      sem_mensalidade: doSistema.filter((l) => !l.ativo && !l.cancelada && l.status !== 'inativo').length,
      so_asaas: linhas.length - doSistema.length,
      todos: linhas.length,
    } as Record<AbaLista, number>,
    semCliente: doSistema.filter((l) => !l.clienteId).length,
    // Clientes com lançamento do Catálogo cadastrados só como "Agência".
    tipoErrado: linha === 'catalogo_place' ? base.filter((c) => c.tipo !== 'saas' && c.tipo !== 'ambos') : [],
    clientesSemAsaas: base.filter((c) => !c.asaas_customer_id).map((c) => ({ id: c.id, nome: c.nome.trim() })),
    customersSemCliente: [...semCliente.entries()].map(([id, subs]) => ({
      id, nome: `${subs[0].customerNome ?? id} · ${formatCurrency(subs[0].valor)}/${cicloLabel[subs[0].ciclo] ?? subs[0].ciclo}`,
    })),
  }
}

export type ResultadoLinha = ReturnType<typeof montarLinha>

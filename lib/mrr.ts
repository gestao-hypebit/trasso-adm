import { addMonthsISO } from '@/lib/utils'

// MRR calculado a partir de lançamentos avulsos de mensalidade (um por cliente por mês).
//
// - Cliente ativo: tem mensalidade lançada no mês atual ou no mês anterior
//   (quem ainda não pagou o mês corrente não vira churn antes da hora).
// - Valor mensal do cliente: o do mês atual, ou o do mês anterior se ainda não lançou.
// - Novo: primeiro mês com mensalidade. Churn: tinha no mês M-1 e não tem no mês M
//   (só avaliado em meses fechados).

export type LancamentoMrr = {
  valor: number
  data: string
  status: string
  descricao: string
  cliente_id: string | null
  clientes: { nome: string; whatsapp: string | null; telefone: string | null } | null
  categorias_financeiras: { nome: string } | null
}

export type ClienteMrr = {
  chave: string
  nome: string
  categoria: string
  whatsapp: string | null
  valorMensal: number
  desde: string        // YYYY-MM do primeiro pagamento
  ultimoLancamento: string
  mesesPagos: number
  pagoEsteMes: boolean // tem mensalidade *recebida* no mês atual
}

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MESES_RE = new RegExp(`\\b(${[...MESES, ...MESES.map(m => m.slice(0, 3))].join('|')})\\b`, 'g')

// "Mensalidade Loja X - Setembro/26" e "Mensalidade loja x (out)" viram a mesma chave.
export function normalizarDescricao(d: string): string {
  return d
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(MESES_RE, ' ')
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// Nome para exibir quando não há cliente vinculado: tira mês, datas e pontuação solta.
// "Mensalidade Loja B - Setembro/26" → "Mensalidade Loja B"
// Lookarounds com \p{L} em vez de \b, que não reconhece letras acentuadas.
const MESES_EXIBICAO_RE = /(?<!\p{L})(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?!\p{L})/giu
export function nomeExibicao(d: string): string {
  const limpo = d
    .replace(MESES_EXIBICAO_RE, ' ')
    .replace(/\d+([/.-]\d+)*/g, ' ')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s*[-–—/|:]+\s*$/g, '')
    .replace(/\s+[-–—/|:]+(\s+|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return limpo || d
}

const mesDe = (data: string) => data.slice(0, 7)
const mesOffset = (mes: string, n: number) => addMonthsISO(mes + '-01', n).slice(0, 7)

export function calcularMrr(lancamentos: LancamentoMrr[], hoje: string) {
  const mesAtual = mesDe(hoje)
  const mesAnterior = mesOffset(mesAtual, -1)

  type Acc = { nome: string; categoria: string; whatsapp: string | null; porMes: Map<string, number>; recebidoMes: Set<string>; ultimo: string }
  const porCliente = new Map<string, Acc>()

  for (const l of lancamentos) {
    if (l.status === 'cancelado' || mesDe(l.data) > mesAtual) continue
    const chave = l.cliente_id ?? `d:${normalizarDescricao(l.descricao)}`
    let c = porCliente.get(chave)
    if (!c) {
      c = { nome: l.clientes?.nome ?? nomeExibicao(l.descricao), categoria: l.categorias_financeiras?.nome ?? '—', whatsapp: l.clientes?.whatsapp ?? l.clientes?.telefone ?? null, porMes: new Map(), recebidoMes: new Set(), ultimo: l.data }
      porCliente.set(chave, c)
    }
    const m = mesDe(l.data)
    c.porMes.set(m, (c.porMes.get(m) ?? 0) + Number(l.valor))
    if (l.status === 'recebido') c.recebidoMes.add(m)
    if (l.data >= c.ultimo) {
      c.ultimo = l.data
      c.categoria = l.categorias_financeiras?.nome ?? c.categoria
      if (!l.clientes) c.nome = nomeExibicao(l.descricao)
    }
  }

  const todos: ClienteMrr[] = [...porCliente.entries()].map(([chave, c]) => {
    const meses = [...c.porMes.keys()].sort()
    return {
      chave, nome: c.nome, categoria: c.categoria, whatsapp: c.whatsapp,
      valorMensal: c.porMes.get(mesAtual) ?? c.porMes.get(mesAnterior) ?? 0,
      desde: meses[0], ultimoLancamento: c.ultimo, mesesPagos: meses.length,
      pagoEsteMes: c.recebidoMes.has(mesAtual),
    }
  })
  const ativos = todos
    .filter(c => porCliente.get(c.chave)!.porMes.has(mesAtual) || porCliente.get(c.chave)!.porMes.has(mesAnterior))
    .sort((a, b) => b.valorMensal - a.valorMensal)

  const mrr = ativos.reduce((s, c) => s + c.valorMensal, 0)
  const tem = (chave: string, mes: string) => porCliente.get(chave)!.porMes.has(mes)
  const valor = (chave: string, mes: string) => porCliente.get(chave)!.porMes.get(mes) ?? 0

  // Movimento de um mês fechado (ou novos do mês atual).
  function movimento(mes: string) {
    const ant = mesOffset(mes, -1)
    const base = todos.filter(c => tem(c.chave, ant))
    const novos = todos.filter(c => c.desde === mes)
    const perdidos = base.filter(c => !tem(c.chave, mes))
    return {
      base: base.length,
      novos: novos.length, novoMrr: novos.reduce((s, c) => s + valor(c.chave, mes), 0),
      churn: perdidos.length, churnMrr: perdidos.reduce((s, c) => s + valor(c.chave, ant), 0),
      taxaChurn: base.length ? perdidos.length / base.length : 0,
    }
  }

  const serie = Array.from({ length: 12 }, (_, i) => {
    const mes = mesOffset(mesAtual, i - 11)
    if (mes === mesAtual) return { mesKey: mes, mrr, clientes: ativos.length }
    const doMes = todos.filter(c => tem(c.chave, mes))
    return { mesKey: mes, mrr: doMes.reduce((s, c) => s + valor(c.chave, mes), 0), clientes: doMes.length }
  })

  const ultimos6 = Array.from({ length: 6 }, (_, i) => movimento(mesOffset(mesAtual, -1 - i))).filter(m => m.base > 0)
  const churnMedio = ultimos6.length ? ultimos6.reduce((s, m) => s + m.taxaChurn, 0) / ultimos6.length : 0
  const arpa = ativos.length ? mrr / ativos.length : 0

  const porCategoria = Object.entries(
    ativos.reduce((acc, c) => {
      acc[c.categoria] = acc[c.categoria] ?? { valor: 0, qtd: 0 }
      acc[c.categoria].valor += c.valorMensal
      acc[c.categoria].qtd += 1
      return acc
    }, {} as Record<string, { valor: number; qtd: number }>)
  ).sort((a, b) => b[1].valor - a[1].valor)

  const mrr12 = serie[0].mrr

  return {
    mrr, arr: mrr * 12, arpa, ativos, serie, porCategoria,
    aguardando: ativos.filter(c => !c.pagoEsteMes),
    mesAtual: movimento(mesAtual),
    mesPassado: movimento(mesAnterior),
    churnMedio,
    ltv: churnMedio > 0 ? arpa / churnMedio : null,
    crescimento12m: mrr12 > 0 ? (mrr - mrr12) / mrr12 : null,
  }
}

import { toISODateLocal } from '@/lib/utils'

export type Frente = 'catalogo_place' | 'trasso'
export type TipoMov = 'novo' | 'cancelamento'

export type Movimentacao = {
  id: string
  data: string
  cliente_nome: string
  frente: Frente
  tipo: TipoMov
  canal: string | null
  valor: number
  motivo: string | null
  observacoes: string | null
}

export type MetaMensal = {
  id: string
  competencia: string
  frente: Frente
  meta_novos: number
  base_anterior: number | null
}

// Paleta validada (CVD + contraste) contra a superfície escura #141318.
export const FRENTES: { value: Frente; label: string; descricao: string; cor: string }[] = [
  { value: 'catalogo_place', label: 'Catálogo Place', descricao: 'Assinaturas do SaaS', cor: '#8B5CF6' },
  { value: 'trasso', label: 'Trasso', descricao: 'Serviços (sites, sistemas…)', cor: '#76A000' },
]

export const COR_CANCELAMENTO = '#E0457B'

export const CANAIS = [
  { value: 'captacao_ativa', label: 'Captação ativa' },
  { value: 'trafego_pago', label: 'Tráfego pago' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outro', label: 'Outro' },
]

export const MOTIVOS_SUGERIDOS = ['Achou o preço alto', 'Não estava usando', 'Fechou o negócio', 'Foi para concorrente', 'Problema técnico']

export const labelFrente = (v: string) => FRENTES.find((f) => f.value === v)?.label ?? v
export const corFrente = (v: string) => FRENTES.find((f) => f.value === v)?.cor ?? '#8B5CF6'
export const labelCanal = (v: string | null) => (v ? CANAIS.find((c) => c.value === v)?.label ?? v : '—')

// ---------------------------------------------------------------
// Datas de competência (mês = 'YYYY-MM')
// ---------------------------------------------------------------
export const mesAtual = () => toISODateLocal(new Date()).slice(0, 7)

export function somarMeses(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const diasNoMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export const inicioMes = (mes: string) => `${mes}-01`
export const fimMes = (mes: string) => `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}`

export function nomeMes(mes: string, curto = false): string {
  const [y, m] = mes.split('-').map(Number)
  const nome = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: curto ? 'short' : 'long' }).replace('.', '')
  const cap = nome.charAt(0).toUpperCase() + nome.slice(1)
  return curto ? cap : `${cap} ${y}`
}

// ---------------------------------------------------------------
// Resumo de uma frente num mês
// ---------------------------------------------------------------
export type Ritmo = 'adiantado' | 'no_ritmo' | 'atrasado'

export type ResumoFrente = {
  frente: Frente
  meta: number
  base: number | null
  crescimento: number | null
  novos: number
  cancelamentos: number
  saldo: number
  valorGanho: number
  valorPerdido: number
  pct: number
  faltam: number
  // Só para o mês corrente:
  esperadoHoje: number | null
  ritmo: Ritmo | null
  projecao: number | null
  porDiaNecessario: number | null
  diasRestantes: number | null
  // Acumulado diário: [{ dia, realizado, ideal }]
  serie: { dia: number; realizado: number | null; ideal: number }[]
}

export function resumirFrente(
  frente: Frente,
  mes: string,
  movs: Movimentacao[],
  metas: MetaMensal[],
): ResumoFrente {
  const doMes = movs.filter((m) => m.frente === frente && m.data.startsWith(mes))
  const novosMov = doMes.filter((m) => m.tipo === 'novo')
  const cancMov = doMes.filter((m) => m.tipo === 'cancelamento')
  const metaReg = metas.find((m) => m.frente === frente && m.competencia.startsWith(mes))
  const meta = metaReg?.meta_novos ?? 0

  // Base = realizado do mês anterior. Se o mês anterior tem registros no
  // sistema, eles mandam; senão, usa o valor digitado (herdado da planilha).
  const anterior = somarMeses(mes, -1)
  const novosAnterior = movs.filter((m) => m.frente === frente && m.tipo === 'novo' && m.data.startsWith(anterior)).length
  const base = novosAnterior > 0 ? novosAnterior : metaReg?.base_anterior ?? null
  const crescimento = base && meta ? (meta - base) / base : null

  const novos = novosMov.length
  const cancelamentos = cancMov.length
  const pct = meta > 0 ? novos / meta : 0
  const faltam = Math.max(meta - novos, 0)

  const totalDias = diasNoMes(mes)
  const hoje = mesAtual() === mes ? new Date().getDate() : mes < mesAtual() ? totalDias : 0

  let esperadoHoje: number | null = null
  let ritmo: Ritmo | null = null
  let projecao: number | null = null
  let porDiaNecessario: number | null = null
  let diasRestantes: number | null = null

  if (mes === mesAtual() && meta > 0) {
    esperadoHoje = (meta * hoje) / totalDias
    const diff = novos - esperadoHoje
    // Tolerância de ~1 cliente ou 5% da meta para não oscilar à toa.
    const tolerancia = Math.max(1, meta * 0.05)
    ritmo = diff > tolerancia ? 'adiantado' : diff < -tolerancia ? 'atrasado' : 'no_ritmo'
    projecao = Math.round((novos / hoje) * totalDias)
    diasRestantes = totalDias - hoje + 1
    porDiaNecessario = faltam / diasRestantes
  }

  const porDia = new Array(totalDias + 1).fill(0)
  novosMov.forEach((m) => { porDia[Number(m.data.slice(8, 10))] += 1 })
  let acc = 0
  const serie = Array.from({ length: totalDias }, (_, i) => {
    const dia = i + 1
    acc += porDia[dia]
    return { dia, realizado: dia <= hoje ? acc : null, ideal: meta > 0 ? Math.round(((meta * dia) / totalDias) * 10) / 10 : 0 }
  })

  return {
    frente, meta, base, crescimento, novos, cancelamentos,
    saldo: novos - cancelamentos,
    valorGanho: novosMov.reduce((s, m) => s + Number(m.valor || 0), 0),
    valorPerdido: cancMov.reduce((s, m) => s + Number(m.valor || 0), 0),
    pct, faltam, esperadoHoje, ritmo, projecao, porDiaNecessario, diasRestantes, serie,
  }
}

// Contagem agrupada, maior primeiro.
export function agrupar<T>(itens: T[], chave: (i: T) => string): { chave: string; total: number }[] {
  const mapa = new Map<string, number>()
  itens.forEach((i) => mapa.set(chave(i), (mapa.get(chave(i)) ?? 0) + 1))
  return [...mapa.entries()].map(([k, total]) => ({ chave: k, total })).sort((a, b) => b.total - a.total)
}

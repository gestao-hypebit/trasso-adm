// Regras de leitura dos itens da proposta, usadas pelo PDF e pela página da proposta.

export const PERIODOS: Record<string, { label: string; sufixo: string }> = {
  mensal:     { label: 'Mensal',     sufixo: '/mês' },
  trimestral: { label: 'Trimestral', sufixo: '/trimestre' },
  anual:      { label: 'Anual',      sufixo: '/ano' },
}

// 1ª linha da descrição do item = nome do módulo; demais linhas = funcionalidades.
export function parseItem(descricao: string) {
  const [nome, ...resto] = descricao.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  return { nome: nome ?? '', features: resto.map(l => l.replace(/^[-•*·–]\s*/, '')) }
}

export type ItemValor = { quantidade: number; valor_unitario: number; recorrencia?: string | null }

export const ehRecorrente = (i: ItemValor) => !!i.recorrencia && i.recorrencia !== 'avulso'

// Investimento inicial (avulsos) e recorrência agrupada por período, já com desconto.
export function resumoInvestimento<T extends ItemValor>(itens: T[], descontoPercentual: number) {
  const total = (lista: T[]) => lista.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0)
  const fator = 1 - (descontoPercentual ?? 0) / 100
  const avulsos = itens.filter(i => !ehRecorrente(i))
  const recorrentes = itens.filter(ehRecorrente)

  const porPeriodo = Object.keys(PERIODOS)
    .map(p => ({ periodo: p, valor: total(recorrentes.filter(i => i.recorrencia === p)) }))
    .filter(g => g.valor > 0)
  const outros = recorrentes.filter(i => !PERIODOS[i.recorrencia ?? ''])
  if (outros.length) porPeriodo.push({ periodo: 'outro', valor: total(outros) })

  const subtotalAvulso = total(avulsos)
  const subtotalRec = total(recorrentes)
  return {
    avulsos, recorrentes, porPeriodo, fator,
    subtotalAvulso, subtotalRec,
    temDesconto: descontoPercentual > 0,
    economia: (subtotalAvulso + subtotalRec) * (1 - fator),
    mostraInicial: avulsos.length > 0 || recorrentes.length === 0,
  }
}

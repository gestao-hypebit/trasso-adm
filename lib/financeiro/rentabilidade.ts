export type LancamentoProjeto = { projeto_id: string | null; tipo: string; valor: number; status: string }
export type ApontamentoProjeto = { projeto_id: string; horas: number }

export type Rentabilidade = {
  valorContratado: number
  receitaPrevista: number
  receitaRecebida: number
  custosDiretos: number
  horas: number
  custoHoras: number
  lucro: number
  margem: number | null
  valorHoraEfetivo: number | null
}

// Receita considerada = lançamentos de receita vinculados ao projeto; sem lançamentos, usa o valor do projeto.
export function calcularRentabilidade(
  valorProjeto: number | null,
  lancamentos: LancamentoProjeto[],
  apontamentos: ApontamentoProjeto[],
  custoHora: number,
): Rentabilidade {
  const ativos = lancamentos.filter((l) => l.status !== 'cancelado')
  const receitas = ativos.filter((l) => l.tipo === 'receita')
  const receitaLancada = receitas.reduce((s, l) => s + Number(l.valor), 0)
  const receitaRecebida = receitas.filter((l) => l.status === 'recebido').reduce((s, l) => s + Number(l.valor), 0)
  const custosDiretos = ativos.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0)
  const horas = apontamentos.reduce((s, a) => s + Number(a.horas), 0)
  const custoHoras = horas * custoHora
  const valorContratado = Number(valorProjeto ?? 0)
  const receitaPrevista = receitaLancada > 0 ? receitaLancada : valorContratado
  const lucro = receitaPrevista - custosDiretos - custoHoras
  return {
    valorContratado,
    receitaPrevista,
    receitaRecebida,
    custosDiretos,
    horas,
    custoHoras,
    lucro,
    margem: receitaPrevista > 0 ? lucro / receitaPrevista : null,
    valorHoraEfetivo: horas > 0 ? (receitaPrevista - custosDiretos) / horas : null,
  }
}

export function corMargem(margem: number | null): string {
  if (margem === null) return 'text-brand-lavanda/50'
  if (margem < 0) return 'text-brand-rosa'
  if (margem < 0.3) return 'text-yellow-400'
  return 'text-brand-lima'
}

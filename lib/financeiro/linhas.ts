// Linha de receita de cada lançamento (coluna `frente` no banco).
// A empresa é uma só: a linha serve para ver de onde vem o dinheiro,
// não para separar o caixa.
//   agencia         → serviços (sites, software, social…)
//   catalogo_place  → mensalidades e custos do Catálogo Place
//   geral           → custos da empresa toda (contabilidade, impostos…)
export type Linha = 'agencia' | 'catalogo_place' | 'geral'

export const linhaOpcoes: { value: Linha; label: string }[] = [
  { value: 'agencia', label: 'Serviços' },
  { value: 'catalogo_place', label: 'Catálogo Place' },
  { value: 'geral', label: 'Geral' },
]

// Linhas que geram receita (as que aparecem nos filtros e na divisão da receita).
export const linhasDeReceita = linhaOpcoes.filter((o) => o.value !== 'geral')

export const LINHA_CORES: Record<Linha, string> = {
  agencia: '#7C3AED',
  catalogo_place: '#B8F000',
  geral: '#FF4D8D',
}

export const labelLinha = (v: string | null | undefined) =>
  linhaOpcoes.find((o) => o.value === v)?.label ?? '—'

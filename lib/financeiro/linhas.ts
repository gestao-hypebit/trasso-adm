// Linha de receita de cada lançamento (coluna `frente` no banco).
// A empresa é uma só: a linha serve para ver de onde vem o dinheiro,
// não para separar o caixa.
//   agencia         → serviços (sites, software, social…)
//   catalogo_place  → mensalidades e custos do Catálogo Place
//   clubelly        → mensalidades e custos da Clubelly
//   geral           → custos da empresa toda (contabilidade, impostos…)
export type Linha = 'agencia' | 'catalogo_place' | 'clubelly' | 'geral'

export const linhaOpcoes: { value: Linha; label: string }[] = [
  { value: 'agencia', label: 'Serviços' },
  { value: 'catalogo_place', label: 'Catálogo Place' },
  { value: 'clubelly', label: 'Clubelly' },
  { value: 'geral', label: 'Geral' },
]

// Linhas que geram receita (as que aparecem nos filtros e na divisão da receita).
export const linhasDeReceita = linhaOpcoes.filter((o) => o.value !== 'geral')

export const LINHA_CORES: Record<Linha, string> = {
  agencia: '#7C3AED',
  catalogo_place: '#B8F000',
  clubelly: '#38BDF8',
  geral: '#FF4D8D',
}

export const labelLinha = (v: string | null | undefined) =>
  linhaOpcoes.find((o) => o.value === v)?.label ?? '—'

// ---------------------------------------------------------------
// Os SaaS da agência
// ---------------------------------------------------------------
// O cliente tem tipo "saas" (só SaaS) ou "ambos" (agência + SaaS); qual SaaS
// é vem do produto dele. Sem produto (cadastros antigos) = Catálogo Place.
export type LinhaSaas = 'catalogo_place' | 'clubelly'

export const LINHAS_SAAS: LinhaSaas[] = ['catalogo_place', 'clubelly']

export const ehLinhaSaas = (v: string | null | undefined): v is LinhaSaas => v === 'catalogo_place' || v === 'clubelly'

const CLUBELLY_RE = /clubelly/i
const CATALOGO_RE = /cat[aá]logo/i

export const linhaDoProduto = (nomeProduto: string | null | undefined): LinhaSaas =>
  nomeProduto && CLUBELLY_RE.test(nomeProduto) ? 'clubelly' : 'catalogo_place'

// Linha pela descrição de uma cobrança/assinatura (nulo = a descrição não diz).
export function linhaPelaDescricao(texto: string | null | undefined): LinhaSaas | null {
  if (!texto) return null
  if (CLUBELLY_RE.test(texto)) return 'clubelly'
  if (CATALOGO_RE.test(texto)) return 'catalogo_place'
  return null
}

// Tem algum SaaS? (tipo do cliente)
export const temSaas = (tipo: string | null | undefined) => tipo === 'saas' || tipo === 'ambos'

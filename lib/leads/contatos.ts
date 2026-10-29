// Follow-up dos leads: tentativas de contato (lead_contatos) e o dia do
// próximo contato (leads.proximo_contato). Cálculos puros, sem banco.

export const tipoContatoOpcoes = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'ligacao', label: 'Ligação' },
  { value: 'email', label: 'E-mail' },
  { value: 'direct', label: 'Direct (Instagram)' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'outro', label: 'Outro' },
]

export const resultadoContatoOpcoes = [
  { value: 'sem_resposta', label: 'Sem resposta', classe: 'text-brand-lavanda/50' },
  { value: 'respondeu', label: 'Respondeu', classe: 'text-yellow-300' },
  { value: 'agendou', label: 'Agendou reunião', classe: 'text-brand-lima' },
  { value: 'recusou', label: 'Não tem interesse', classe: 'text-brand-rosa' },
]

const porValor = (opcoes: { value: string; label: string }[]) => Object.fromEntries(opcoes.map((o) => [o.value, o]))
const tipoMap = porValor(tipoContatoOpcoes)
const resultadoMap = porValor(resultadoContatoOpcoes) as Record<string, (typeof resultadoContatoOpcoes)[number]>

export const labelTipoContato = (v: string) => tipoMap[v]?.label ?? v
export const resultadoContato = (v: string) => resultadoMap[v] ?? { value: v, label: v, classe: 'text-brand-lavanda/50' }

export type LeadContato = { id: string; lead_id: string; tipo: string; resultado: string; nota: string | null; created_at: string }

// Origens em que é a gente que vai atrás: o lead já entra "Em contato" e não
// conta na bolinha de "novos" do menu (essa é para quem chegou sozinho).
export const ORIGENS_ATIVAS = ['captacao_ativa', 'representante_comercial']
export const ehCaptacaoAtiva = (origem: string) => ORIGENS_ATIVAS.includes(origem)

// Situação do próximo contato em relação a hoje (datas YYYY-MM-DD de São Paulo).
export type SituacaoContato = 'atrasado' | 'hoje' | 'futuro'

export function situacaoContato(proximo: string | null | undefined, hoje: string): SituacaoContato | null {
  if (!proximo) return null
  return proximo < hoje ? 'atrasado' : proximo === hoje ? 'hoje' : 'futuro'
}

// Lead aberto com contato marcado para hoje ou já vencido.
export const contatoPendente = (proximo: string | null | undefined, hoje: string) => {
  const s = situacaoContato(proximo, hoje)
  return s === 'atrasado' || s === 'hoje'
}

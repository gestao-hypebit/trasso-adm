// Funil de vendas: etapas, canal de origem e as contas da tela /leads/conversao.

import { labelOrigem } from '@/lib/crm/opcoes'
import { leadStatusConfig, type LeadStatus } from '@/lib/leads/formulario'

// Etapas "andando" do funil, na ordem. Perdido fica de fora: não é etapa, é saída.
export const ETAPAS_FUNIL: LeadStatus[] = ['novo', 'em_contato', 'qualificado', 'proposta', 'convertido']
export const ETAPAS_ABERTAS: LeadStatus[] = ['novo', 'em_contato', 'qualificado', 'proposta']

export const etapaLabel = (status: string) => leadStatusConfig[status as LeadStatus]?.label ?? status

export const motivoPerdaOpcoes = [
  'Preço / orçamento',
  'Não respondeu mais',
  'Fechou com outra empresa',
  'Adiou o projeto',
  'Fora do perfil',
  'Outro',
]

// Origem do lead no formato usado no funil. Leads do site são separados pela
// fonte do anúncio (utm_source) ou, sem UTM, pelo formulário que preencheram.
export function canalDoLead(lead: { origem: string; utm: Record<string, string> | null; formularios?: { nome: string } | null }) {
  if (lead.origem !== 'site') return labelOrigem(lead.origem)
  const fonte = lead.utm?.utm_source
  if (fonte) return `Site · ${fonte}`
  return lead.formularios?.nome ? `Site · ${lead.formularios.nome}` : 'Site'
}

export type LeadFunil = {
  id: string
  status: string
  origem: string
  utm: Record<string, string> | null
  formularios?: { nome: string } | null
  valor_estimado: number | null
  motivo_perda: string | null
  created_at: string
}
export type Historico = { lead_id: string; de: string | null; para: string; created_at: string }

const indice = (status: string) => ETAPAS_FUNIL.indexOf(status as LeadStatus)

// Etapa mais avançada que o lead chegou a atingir (mesmo que depois tenha sido perdido).
export function etapaMaxima(lead: LeadFunil, historico: Historico[]): number {
  let max = Math.max(0, indice(lead.status))
  for (const h of historico) max = Math.max(max, indice(h.para))
  return max
}

export type LinhaCanal = {
  canal: string
  leads: number
  porEtapa: number[] // quantos chegaram em cada etapa de ETAPAS_FUNIL
  perdidos: number
  valorFechado: number
}

export function resumoFunil(leads: LeadFunil[], historico: Historico[]) {
  const porLead = new Map<string, Historico[]>()
  for (const h of historico) {
    const lista = porLead.get(h.lead_id) ?? []
    lista.push(h)
    porLead.set(h.lead_id, lista)
  }
  for (const lista of porLead.values()) lista.sort((a, b) => a.created_at.localeCompare(b.created_at))

  const total = { canal: 'Total', leads: 0, porEtapa: ETAPAS_FUNIL.map(() => 0), perdidos: 0, valorFechado: 0 }
  const canais = new Map<string, LinhaCanal>()
  const motivos = new Map<string, number>()
  // Tempo (ms) que os leads passaram em cada etapa, só de passagens já encerradas.
  const tempos = new Map<string, number[]>()
  const ciclos: number[] = []

  for (const lead of leads) {
    const hist = porLead.get(lead.id) ?? []
    const max = etapaMaxima(lead, hist)
    const canal = canalDoLead(lead)
    const linha = canais.get(canal) ?? { canal, leads: 0, porEtapa: ETAPAS_FUNIL.map(() => 0), perdidos: 0, valorFechado: 0 }

    for (const alvo of [linha, total]) {
      alvo.leads++
      for (let i = 0; i <= max; i++) alvo.porEtapa[i]++
      if (lead.status === 'descartado') alvo.perdidos++
      if (lead.status === 'convertido') alvo.valorFechado += Number(lead.valor_estimado ?? 0)
    }
    canais.set(canal, linha)

    if (lead.status === 'descartado') {
      const motivo = lead.motivo_perda || 'Sem motivo informado'
      motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1)
    }

    for (let i = 0; i < hist.length - 1; i++) {
      const etapa = hist[i].para
      const ms = new Date(hist[i + 1].created_at).getTime() - new Date(hist[i].created_at).getTime()
      const lista = tempos.get(etapa) ?? []
      lista.push(ms)
      tempos.set(etapa, lista)
    }

    const fechamento = hist.find((h) => h.para === 'convertido')
    if (lead.status === 'convertido' && fechamento) {
      ciclos.push(new Date(fechamento.created_at).getTime() - new Date(lead.created_at).getTime())
    }
  }

  const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
  const DIA = 86_400_000

  return {
    total,
    canais: [...canais.values()].sort((a, b) => b.leads - a.leads),
    motivos: [...motivos.entries()].map(([motivo, qtd]) => ({ motivo, qtd })).sort((a, b) => b.qtd - a.qtd),
    diasPorEtapa: ETAPAS_ABERTAS.map((etapa) => {
      const m = media(tempos.get(etapa) ?? [])
      return { etapa, dias: m === null ? null : m / DIA, amostra: tempos.get(etapa)?.length ?? 0 }
    }),
    cicloMedioDias: (() => { const m = media(ciclos); return m === null ? null : m / DIA })(),
  }
}

export const taxa = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 100) : 0)

// Leads de tráfego pago: UTM, temperatura (quente/morno/frio) e as contas do
// painel de campanhas em /leads/conversao. Cálculos puros, sem banco nem rede.

import { FONTES_ANUNCIO } from '@/lib/anuncios/regras'
import { ETAPAS_FUNIL, etapaMaxima, type Historico } from '@/lib/leads/funil'
import type { Resposta } from '@/lib/leads/formulario'
import { normalizarUtm } from '@/lib/leads/utm'

// ---------------------------------------------------------------
// Temperatura: calculada pela landing (respostas "classificacao" e
// "pontuacao") ou escolhida à mão no cadastro/detalhe do lead.
// ---------------------------------------------------------------
export const TEMPERATURAS = ['quente', 'morno', 'frio'] as const
export type Temperatura = (typeof TEMPERATURAS)[number]

export const temperaturaConfig: Record<Temperatura, { label: string; emoji: string; classe: string }> = {
  quente: { label: 'Quente', emoji: '🔥', classe: 'bg-brand-rosa/15 text-brand-rosa border-brand-rosa/30' },
  morno:  { label: 'Morno',  emoji: '🌤️', classe: 'bg-yellow-400/10 text-yellow-300 border-yellow-400/30' },
  frio:   { label: 'Frio',   emoji: '❄️', classe: 'bg-sky-400/10 text-sky-300 border-sky-400/30' },
}

export const CHAVE_TEMPERATURA = 'classificacao'
export const CHAVE_PONTUACAO = 'pontuacao'

export function temperaturaDoLead(lead: { respostas: Resposta[] | null }): Temperatura | null {
  const v = lead.respostas?.find((r) => r.chave === CHAVE_TEMPERATURA)?.valor
  return typeof v === 'string' && (TEMPERATURAS as readonly string[]).includes(v) ? (v as Temperatura) : null
}

export function pontuacaoDoLead(lead: { respostas: Resposta[] | null }): number | null {
  const v = lead.respostas?.find((r) => r.chave === CHAVE_PONTUACAO)?.valor
  const n = typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

// Troca (ou remove) a temperatura nas respostas sem mexer nas outras.
export function comTemperatura(respostas: Resposta[] | null, temperatura: Temperatura | null): Resposta[] {
  const resto = (respostas ?? []).filter((r) => r.chave !== CHAVE_TEMPERATURA)
  return temperatura ? [...resto, { chave: CHAVE_TEMPERATURA, rotulo: 'Classificação', valor: temperatura }] : resto
}

// ---------------------------------------------------------------
// Origem: o que conta como tráfego pago
// ---------------------------------------------------------------
export const ORIGENS_TRAFEGO_PAGO = ['trafego_pago', 'trafego_pago_whatsapp', 'landing-site', 'landing-planejadores']

// Despesa conta como investimento em tráfego quando a categoria tem um destes nomes.
export const CATEGORIA_TRAFEGO = /tr[aá]fego|an[uú]ncio|\bads\b/i

export function ehTrafegoPago(lead: { origem: string; utm: Record<string, unknown> | null }) {
  const utm = normalizarUtm(lead.utm)
  if (utm.fbclid) return true
  if (utm.utm_source && FONTES_ANUNCIO.includes(utm.utm_source.toLowerCase())) return true
  return ORIGENS_TRAFEGO_PAGO.includes(lead.origem)
}

// Valor de partida do lead por formulário do site (o preço da oferta da landing).
export const VALOR_PADRAO_POR_FORMULARIO: Record<string, number> = {
  'landing-planejadores': 947,
  'landing-site': 750,
}

// ---------------------------------------------------------------
// Painel de campanhas
// ---------------------------------------------------------------
export type LeadTrafego = {
  id: string
  status: string
  origem: string
  utm: Record<string, unknown> | null
  respostas: Resposta[] | null
  valor_estimado: number | null
  created_at: string
}
export type Campanha = { campaign_id: string; nome: string }
export type GastoCampanha = { campaign_id: string; spend: number }

export type LinhaCampanha = {
  chave: string
  nome: string
  gasto: number | null // null = campanha que o painel não conhece (sem gasto)
  leads: number
  quentes: number
  reunioes: number // chegaram a "Reunião / qualificado"
  vendas: number
  receita: number
}

const SEM_CAMPANHA = 'sem-campanha'
const iReuniao = ETAPAS_FUNIL.indexOf('qualificado')
const iVenda = ETAPAS_FUNIL.indexOf('convertido')

// utm_campaign pode vir com o id ({{campaign.id}}) ou com o nome da campanha.
function acharCampanha(utmCampaign: string | undefined, campanhas: Campanha[]) {
  if (!utmCampaign) return null
  const alvo = utmCampaign.toLowerCase()
  return campanhas.find((c) => c.campaign_id === utmCampaign || c.nome.toLowerCase() === alvo) ?? null
}

export function resumoCampanhas(
  leads: LeadTrafego[],
  historico: Historico[],
  campanhas: Campanha[],
  gastos: GastoCampanha[],
) {
  const histPorLead = new Map<string, Historico[]>()
  for (const h of historico) histPorLead.set(h.lead_id, [...(histPorLead.get(h.lead_id) ?? []), h])

  const gastoPorCampanha = new Map<string, number>()
  for (const g of gastos) gastoPorCampanha.set(g.campaign_id, (gastoPorCampanha.get(g.campaign_id) ?? 0) + Number(g.spend))

  const linhas = new Map<string, LinhaCampanha>()
  const linha = (chave: string, nome: string, gasto: number | null) => {
    const atual = linhas.get(chave) ?? { chave, nome, gasto, leads: 0, quentes: 0, reunioes: 0, vendas: 0, receita: 0 }
    linhas.set(chave, atual)
    return atual
  }

  // Toda campanha com gasto no período aparece, mesmo sem nenhum lead (dinheiro sem retorno).
  for (const c of campanhas) {
    const gasto = gastoPorCampanha.get(c.campaign_id) ?? 0
    if (gasto > 0) linha(c.campaign_id, c.nome, gasto)
  }

  const porTemperatura = new Map<string, { leads: number; reunioes: number; vendas: number }>()

  for (const lead of leads) {
    const utm = normalizarUtm(lead.utm)
    const campanha = acharCampanha(utm.utm_campaign, campanhas)
    const alvo = campanha
      ? linha(campanha.campaign_id, campanha.nome, gastoPorCampanha.get(campanha.campaign_id) ?? 0)
      : utm.utm_campaign
        ? linha(`utm:${utm.utm_campaign}`, utm.utm_campaign, null)
        : linha(SEM_CAMPANHA, 'Sem campanha identificada', null)

    const max = etapaMaxima(lead, histPorLead.get(lead.id) ?? [])
    const reuniao = max >= iReuniao
    const venda = lead.status === 'convertido'
    const temperatura = temperaturaDoLead(lead)

    alvo.leads++
    if (temperatura === 'quente') alvo.quentes++
    if (reuniao) alvo.reunioes++
    if (venda) {
      alvo.vendas++
      alvo.receita += Number(lead.valor_estimado ?? 0)
    }

    const t = porTemperatura.get(temperatura ?? 'sem') ?? { leads: 0, reunioes: 0, vendas: 0 }
    t.leads++
    if (reuniao) t.reunioes++
    if (venda) t.vendas++
    porTemperatura.set(temperatura ?? 'sem', t)
  }

  const lista = [...linhas.values()].sort((a, b) => (b.gasto ?? 0) - (a.gasto ?? 0) || b.leads - a.leads)
  const total = lista.reduce(
    (s, l) => ({
      gasto: s.gasto + (l.gasto ?? 0),
      leads: s.leads + l.leads,
      quentes: s.quentes + l.quentes,
      reunioes: s.reunioes + l.reunioes,
      vendas: s.vendas + l.vendas,
      receita: s.receita + l.receita,
    }),
    { gasto: 0, leads: 0, quentes: 0, reunioes: 0, vendas: 0, receita: 0 },
  )

  return {
    campanhas: lista,
    total,
    temperaturas: [...TEMPERATURAS, 'sem' as const].map((t) => ({
      temperatura: t,
      ...(porTemperatura.get(t) ?? { leads: 0, reunioes: 0, vendas: 0 }),
    })),
  }
}

// Custo por resultado; null quando não houve gasto ou resultado.
export const custoPor = (gasto: number, qtd: number) => (gasto > 0 && qtd > 0 ? gasto / qtd : null)

// Tempo (horas) entre o lead chegar e sair de "Novo" pela primeira vez.
export function horasAtePrimeiroContato(lead: { id: string; created_at: string }, historico: Historico[]): number | null {
  const saida = historico
    .filter((h) => h.lead_id === lead.id && h.de === 'novo')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
  if (!saida) return null
  return Math.max(0, (new Date(saida.created_at).getTime() - new Date(lead.created_at).getTime()) / 3_600_000)
}

export function mediana(xs: number[]) {
  if (xs.length === 0) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

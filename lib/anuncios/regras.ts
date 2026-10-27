// Regras do módulo de anúncios (cálculos puros, sem banco nem rede).

export const FUSO = 'America/Sao_Paulo'

export type TipoEvento = 'cadastro' | 'ativacao' | 'assinatura' | 'cancelamento'
export const TIPOS_EVENTO: TipoEvento[] = ['cadastro', 'ativacao', 'assinatura', 'cancelamento']

// utm_source que contam como "veio de anúncio" (mesma lista da coluna gerada funil_eventos.de_anuncio).
export const FONTES_ANUNCIO = ['meta', 'facebook', 'instagram', 'fb', 'ig', 'facebook_ads', 'meta_ads']

// ---------------------------------------------------------------
// Datas no fuso de São Paulo
// ---------------------------------------------------------------
const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

// YYYY-MM-DD do instante no fuso de São Paulo.
export const diaSP = (d: Date | string) => fmtDia.format(typeof d === 'string' ? new Date(d) : d)

export function somarDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function diasEntre(de: string, ate: string) {
  const out: string[] = []
  for (let d = de; d <= ate; d = somarDias(d, 1)) out.push(d)
  return out
}

// ---------------------------------------------------------------
// Campanha → marca pelo prefixo do nome
// ---------------------------------------------------------------
export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export type MarcaPrefixos = { id: string; prefixos: string[] }

// O nome casa com o prefixo quando começa com ele e logo depois vem fim,
// espaço ou separador ("CP | …", "CP - …"). Assim "CPX" não vira CP.
// Vários prefixos casando: vence o mais longo.
export function marcaPorPrefixo(nomeCampanha: string, marcas: MarcaPrefixos[]): string | null {
  const nome = normalizar(nomeCampanha)
  let melhor: { id: string; tam: number } | null = null
  for (const m of marcas) {
    for (const p of m.prefixos) {
      const pre = normalizar(p)
      if (!pre || !nome.startsWith(pre)) continue
      const depois = nome.charAt(pre.length)
      if (depois && !/[\s|\-–—:/_\[\]()]/.test(depois)) continue
      if (!melhor || pre.length > melhor.tam) melhor = { id: m.id, tam: pre.length }
    }
  }
  return melhor?.id ?? null
}

// ---------------------------------------------------------------
// Janelas de sincronização
// ---------------------------------------------------------------
export const MESES_HISTORICO = 37 // o máximo que o Meta guarda de insights
export const DIAS_REPROCESSO = 7
export const DIAS_POR_BLOCO = 30
export const DIAS_POR_BLOCO_MENOR = 7 // quando o Meta reclama de dados demais num bloco

// Dia mais antigo que o Meta ainda devolve (com 1 dia de folga).
export function inicioHistorico(hoje: string) {
  const [a, m, d] = hoje.split('-').map(Number)
  const alvo = new Date(Date.UTC(a, m - 1 - MESES_HISTORICO, d))
  return somarDias(alvo.toISOString().slice(0, 10), 1)
}

// Os últimos 7 dias: reprocessados em toda rodada (o Meta corrige números para trás).
export const janelaRecente = (hoje: string) => ({ de: somarDias(hoje, -(DIAS_REPROCESSO - 1)), ate: hoje })

// Próximo bloco da carga do histórico, de trás para frente: termina no dia
// anterior ao mais antigo já carregado (ou hoje, na primeira vez) e para no
// limite do Meta. `fim` = este é o último bloco.
export function janelaHistorico(hoje: string, historicoDesde: string | null, bloco = DIAS_POR_BLOCO, limite = inicioHistorico(hoje)) {
  const ate = historicoDesde ? somarDias(historicoDesde, -1) : hoje
  const de = somarDias(ate, -(bloco - 1))
  return de <= limite ? { de: limite, ate, fim: true } : { de, ate, fim: false }
}

// ---------------------------------------------------------------
// Insights do Meta
// ---------------------------------------------------------------
type AcaoMeta = { action_type: string; value: string | number }

// [{ action_type, value }] → { action_type: número }
export function acoesParaMapa(acoes: AcaoMeta[] | undefined | null): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of acoes ?? []) {
    const v = Number(a.value)
    if (a.action_type && Number.isFinite(v)) out[a.action_type] = v
  }
  return out
}

// O Meta repete a mesma conversão com nomes diferentes (agregado, pixel, omni).
// Em cada grupo vale o maior; os grupos (lead e cadastro completo) somam.
const GRUPOS_CONVERSAO = [
  ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'omni_lead'],
  ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration', 'omni_complete_registration'],
]

export function conversoesMeta(acoes: Record<string, number> | null | undefined) {
  if (!acoes) return 0
  return GRUPOS_CONVERSAO.reduce((s, g) => s + Math.max(0, ...g.map((t) => acoes[t] ?? 0)), 0)
}

// Tira token e afins de qualquer texto antes de ir para log/banco/tela.
export function limparSegredos(texto: string, segredos: (string | undefined)[] = []) {
  let t = texto
  for (const s of segredos) if (s && s.length >= 8) t = t.split(s).join('[oculto]')
  return t
    .replace(/access_token=[^&\s"']+/gi, 'access_token=[oculto]')
    .replace(/appsecret_proof=[^&\s"']+/gi, 'appsecret_proof=[oculto]')
    .replace(/\bEA[A-Za-z0-9]{30,}/g, '[oculto]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [oculto]')
}

// ---------------------------------------------------------------
// Métricas do painel
// ---------------------------------------------------------------
export type Metrica = {
  data: string
  campaign_id: string
  ad_id: string
  ad_name: string | null
  campaign_name: string | null
  spend: number
  impressions: number
  clicks: number
  inline_link_clicks: number
  actions: Record<string, number> | null
}

export type Evento = {
  marca_id: string
  tipo: TipoEvento
  cliente_ref: string
  ocorrido_em: string
  valor: number | null
  ad_id: string | null
  campaign_id: string | null
  de_anuncio: boolean
}

// Origem de cada cliente: ele "veio de anúncio" se algum evento dele veio;
// a campanha/anúncio é a do primeiro evento de anúncio (normalmente o cadastro).
export type ClienteFunil = {
  chave: string           // marca_id + cliente_ref
  marca_id: string
  de_anuncio: boolean
  ad_id: string | null
  campaign_id: string | null
  cadastro: string | null         // dia (SP) do primeiro cadastro
  primeira_ativacao: string | null
  primeira_assinatura: string | null
  mrr: number                     // valor da assinatura vigente (0 se cancelou depois)
}

export function clientesDoFunil(eventos: Evento[]): ClienteFunil[] {
  const porCliente = new Map<string, Evento[]>()
  for (const e of eventos) {
    const k = `${e.marca_id}:${e.cliente_ref}`
    const l = porCliente.get(k)
    if (l) l.push(e)
    else porCliente.set(k, [e])
  }
  const out: ClienteFunil[] = []
  for (const [chave, lista] of porCliente) {
    lista.sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em))
    const origem = lista.find((e) => e.de_anuncio && (e.ad_id || e.campaign_id)) ?? lista.find((e) => e.de_anuncio)
    const cadastro = lista.find((e) => e.tipo === 'cadastro')
    const ativacao = lista.find((e) => e.tipo === 'ativacao')
    const assinaturas = lista.filter((e) => e.tipo === 'assinatura')
    // Vigente: a última assinatura, se não houve cancelamento depois dela.
    const ultimaAss = assinaturas.at(-1)
    const ultimoCanc = lista.filter((e) => e.tipo === 'cancelamento').at(-1)
    const vigente = ultimaAss && (!ultimoCanc || ultimoCanc.ocorrido_em < ultimaAss.ocorrido_em)
    out.push({
      chave,
      marca_id: lista[0].marca_id,
      de_anuncio: !!origem,
      ad_id: origem?.ad_id ?? null,
      campaign_id: origem?.campaign_id ?? null,
      cadastro: cadastro ? diaSP(cadastro.ocorrido_em) : null,
      primeira_ativacao: ativacao ? diaSP(ativacao.ocorrido_em) : null,
      primeira_assinatura: assinaturas[0] ? diaSP(assinaturas[0].ocorrido_em) : null,
      mrr: vigente ? Number(ultimaAss!.valor ?? 0) : 0,
    })
  }
  return out
}

export type Resumo = {
  gasto: number
  impressoes: number
  cliques: number          // cliques no link
  conversoesMeta: number
  cadastros: number
  assinaturas: number
  mrr: number
  ctr: number | null
  custoPorCadastro: number | null
  cac: number | null
}

const div = (a: number, b: number) => (b > 0 ? a / b : null)

// Junta gasto (métricas) e resultado (clientes de anúncio) num período.
// Cadastros = clientes de anúncio cujo 1º cadastro caiu no período.
// Assinaturas = clientes de anúncio cuja 1ª assinatura caiu no período.
// MRR = assinatura vigente hoje desses novos assinantes.
export function resumir(metricas: Metrica[], clientes: ClienteFunil[], de: string, ate: string): Resumo {
  let gasto = 0, impressoes = 0, cliques = 0, conversoes = 0
  for (const m of metricas) {
    if (m.data < de || m.data > ate) continue
    gasto += Number(m.spend)
    impressoes += Number(m.impressions)
    cliques += Number(m.inline_link_clicks)
    conversoes += conversoesMeta(m.actions)
  }
  const doAnuncio = clientes.filter((c) => c.de_anuncio)
  const cadastros = doAnuncio.filter((c) => c.cadastro && c.cadastro >= de && c.cadastro <= ate).length
  const novos = doAnuncio.filter((c) => c.primeira_assinatura && c.primeira_assinatura >= de && c.primeira_assinatura <= ate)
  const mrr = novos.reduce((s, c) => s + c.mrr, 0)
  return {
    gasto, impressoes, cliques, conversoesMeta: conversoes,
    cadastros, assinaturas: novos.length, mrr,
    ctr: div(cliques, impressoes),
    custoPorCadastro: div(gasto, cadastros),
    cac: div(gasto, novos.length),
  }
}

export function gastoPorDia(metricas: Metrica[], de: string, ate: string) {
  const mapa = new Map(diasEntre(de, ate).map((d) => [d, 0]))
  for (const m of metricas) if (mapa.has(m.data)) mapa.set(m.data, mapa.get(m.data)! + Number(m.spend))
  return [...mapa].map(([dia, gasto]) => ({ dia, gasto }))
}

// Agrupa por campanha ou por anúncio (chave), já com o resultado de cada um.
export function porGrupo(metricas: Metrica[], clientes: ClienteFunil[], de: string, ate: string, nivel: 'campaign' | 'ad') {
  const chaveM = (m: Metrica) => (nivel === 'campaign' ? m.campaign_id : m.ad_id)
  const chaveC = (c: ClienteFunil) => (nivel === 'campaign' ? c.campaign_id : c.ad_id)
  const grupos = new Map<string, { metricas: Metrica[]; clientes: ClienteFunil[]; nome: string; campaign_id: string }>()
  const pegar = (id: string, nome: string, campaign_id: string) => {
    let g = grupos.get(id)
    if (!g) grupos.set(id, (g = { metricas: [], clientes: [], nome, campaign_id }))
    return g
  }
  for (const m of metricas) {
    if (m.data < de || m.data > ate) continue
    const g = pegar(chaveM(m), (nivel === 'campaign' ? m.campaign_name : m.ad_name) ?? chaveM(m), m.campaign_id)
    g.metricas.push(m)
  }
  for (const c of clientes) {
    const id = chaveC(c)
    if (id && grupos.has(id)) grupos.get(id)!.clientes.push(c)
  }
  return [...grupos].map(([id, g]) => ({ id, nome: g.nome, campaign_id: g.campaign_id, ...resumir(g.metricas, g.clientes, de, ate) }))
    .sort((a, b) => b.gasto - a.gasto)
}

import 'server-only'
import { acoesParaMapa, limparSegredos } from '@/lib/anuncios/regras'

// Cliente mínimo e SOMENTE LEITURA da Meta Marketing API (Graph API).
// Só faz GET: nada aqui cria, edita ou pausa campanha.
// Variáveis de ambiente:
//   META_ACCESS_TOKEN  token do Usuário do Sistema (ads_read). Nunca sai do servidor.
//   META_API_VERSION   opcional; padrão v26.0

const versao = () => process.env.META_API_VERSION || 'v26.0'
const token = () => process.env.META_ACCESS_TOKEN

export const metaConfigurado = () => !!token()

// Erros que valem nova tentativa: limites de taxa e instabilidade do Meta.
const CODIGOS_TEMPORARIOS = new Set([1, 2, 4, 17, 32, 341, 613, 80000, 80001, 80002, 80003, 80004, 80005, 80006, 80008, 80009, 80014])

export class MetaErro extends Error {
  // muitoDado: o Meta recusou o intervalo por volume; vale tentar com um bloco menor.
  constructor(mensagem: string, public temporario = false, public muitoDado = false) {
    super(limparSegredos(mensagem, [token()]))
  }
}

const MUITO_DADO = /reduce the amount of data/i

// Uso do limite informado pelo Meta nos headers (0–100). Passou de 90: paramos
// antes de levar bloqueio e o resto fica para a próxima rodada.
function usoDoLimite(h: Headers) {
  let maior = 0
  for (const nome of ['x-fb-ads-insights-throttle', 'x-business-use-case-usage', 'x-app-usage', 'x-ad-account-usage']) {
    const bruto = h.get(nome)
    if (!bruto) continue
    // Todos os campos abaixo já vêm em porcentagem do limite.
    for (const [, v] of bruto.matchAll(/"(?:[a-z_]*util_pct|call_count|total_cputime|total_time)":\s*(\d+(?:\.\d+)?)/g)) {
      maior = Math.max(maior, Number(v))
    }
  }
  return maior
}

export type Contexto = {
  prazo: number        // Date.now() limite para esta execução
  chamadas: number
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function get<T>(ctx: Contexto, caminho: string, params: Record<string, string>): Promise<T> {
  const t = token()
  if (!t) throw new MetaErro('META_ACCESS_TOKEN não configurado no servidor.')
  const url = new URL(`https://graph.facebook.com/${versao()}/${caminho}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  for (let tentativa = 0; ; tentativa++) {
    if (Date.now() > ctx.prazo) throw new MetaErro('Tempo da execução esgotado.', true)
    ctx.chamadas++
    let res: Response
    try {
      // Token no header, nunca na URL.
      res = await fetch(url, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' })
    } catch (e) {
      if (tentativa >= 3) throw new MetaErro(`Falha de rede no Meta: ${e instanceof Error ? e.message : String(e)}`, true)
      await esperar(2000 * 2 ** tentativa)
      continue
    }

    const corpo = await res.json().catch(() => null) as { error?: { message?: string; code?: number; error_subcode?: number } } | null
    if (res.ok && corpo && !corpo.error) {
      if (usoDoLimite(res.headers) >= 90) (corpo as Record<string, unknown>).__limite = true
      return corpo as T
    }

    const codigo = corpo?.error?.code
    if (corpo?.error?.error_subcode === 1487534 || MUITO_DADO.test(corpo?.error?.message ?? '')) {
      throw new MetaErro(`Meta ${res.status}: ${corpo?.error?.message ?? 'dados demais no intervalo'}`, false, true)
    }
    const temporario = res.status >= 500 || (codigo !== undefined && CODIGOS_TEMPORARIOS.has(codigo))
    const espera = 2000 * 2 ** tentativa // 2s, 4s, 8s, 16s
    if (temporario && tentativa < 4 && Date.now() + espera < ctx.prazo) {
      await esperar(espera)
      continue
    }
    throw new MetaErro(`Meta ${res.status}${codigo ? ` (código ${codigo})` : ''}: ${corpo?.error?.message ?? 'resposta inválida'}`, temporario)
  }
}

type Pagina<T> = { data: T[]; paging?: { cursors?: { after?: string }; next?: string }; __limite?: true }

// Percorre a paginação pelo cursor "after" (não reaproveita a URL "next",
// que pode trazer o token na query).
async function* paginar<T>(ctx: Contexto, caminho: string, params: Record<string, string>) {
  let after: string | undefined
  do {
    const pagina = await get<Pagina<T>>(ctx, caminho, after ? { ...params, after } : params)
    yield { itens: pagina.data ?? [], limite: !!pagina.__limite }
    after = pagina.paging?.next ? pagina.paging.cursors?.after : undefined
  } while (after)
}

// ---------------------------------------------------------------
// Insights por anúncio e dia
// ---------------------------------------------------------------
type InsightBruto = {
  date_start: string
  campaign_id: string; campaign_name?: string
  adset_id?: string; adset_name?: string
  ad_id: string; ad_name?: string
  spend?: string; impressions?: string; reach?: string; clicks?: string; inline_link_clicks?: string
  actions?: { action_type: string; value: string }[]
  cost_per_action_type?: { action_type: string; value: string }[]
}

export type LinhaInsight = {
  data: string
  campaign_id: string; campaign_name: string | null
  adset_id: string | null; adset_name: string | null
  ad_id: string; ad_name: string | null
  spend: number; impressions: number; reach: number; clicks: number; inline_link_clicks: number
  actions: Record<string, number>
  cost_per_action_type: Record<string, number>
}

const CAMPOS_INSIGHTS = [
  'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name',
  'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks', 'actions', 'cost_per_action_type',
].join(',')

export async function* insightsPorAnuncio(ctx: Contexto, accountId: string, de: string, ate: string) {
  const params = {
    level: 'ad',
    time_increment: '1',
    fields: CAMPOS_INSIGHTS,
    time_range: JSON.stringify({ since: de, until: ate }),
    use_account_attribution_setting: 'true',
    limit: '500',
  }
  for await (const { itens, limite } of paginar<InsightBruto>(ctx, `${accountId}/insights`, params)) {
    const linhas: LinhaInsight[] = itens.map((i) => ({
      data: i.date_start,
      campaign_id: i.campaign_id, campaign_name: i.campaign_name ?? null,
      adset_id: i.adset_id ?? null, adset_name: i.adset_name ?? null,
      ad_id: i.ad_id, ad_name: i.ad_name ?? null,
      spend: Number(i.spend ?? 0),
      impressions: Number(i.impressions ?? 0),
      reach: Number(i.reach ?? 0),
      clicks: Number(i.clicks ?? 0),
      inline_link_clicks: Number(i.inline_link_clicks ?? 0),
      actions: acoesParaMapa(i.actions),
      cost_per_action_type: acoesParaMapa(i.cost_per_action_type),
    }))
    yield { linhas, limite }
  }
}

// ---------------------------------------------------------------
// Campanhas (status e orçamento atuais)
// ---------------------------------------------------------------
type CampanhaBruta = {
  id: string; name: string; objective?: string; status?: string; effective_status?: string
  daily_budget?: string; lifetime_budget?: string
}

export type Campanha = {
  campaign_id: string; nome: string; objetivo: string | null; status: string | null; effective_status: string | null
  orcamento_diario: number | null; orcamento_total: number | null
}

// Orçamento vem na menor unidade da moeda (centavos em BRL).
const centavos = (v?: string) => (v && Number(v) > 0 ? Number(v) / 100 : null)

export async function campanhas(ctx: Contexto, accountId: string) {
  const out: Campanha[] = []
  let limite = false
  const params = { fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget', limit: '500' }
  for await (const p of paginar<CampanhaBruta>(ctx, `${accountId}/campaigns`, params)) {
    limite ||= p.limite
    for (const c of p.itens) {
      out.push({
        campaign_id: c.id, nome: c.name, objetivo: c.objective ?? null,
        status: c.status ?? null, effective_status: c.effective_status ?? null,
        orcamento_diario: centavos(c.daily_budget), orcamento_total: centavos(c.lifetime_budget),
      })
    }
  }
  return { campanhas: out, limite }
}

// ---------------------------------------------------------------
// Pixels (todo o tráfego do site, não só anúncio)
// ---------------------------------------------------------------
export type Pixel = { pixel_id: string; nome: string; ultimo_disparo: string | null }

export async function pixels(ctx: Contexto, accountId: string) {
  const out: Pixel[] = []
  for await (const p of paginar<{ id: string; name: string; last_fired_time?: string }>(ctx, `${accountId}/adspixels`, { fields: 'id,name,last_fired_time', limit: '100' })) {
    for (const x of p.itens) out.push({ pixel_id: x.id, nome: x.name, ultimo_disparo: x.last_fired_time ?? null })
  }
  return out
}

type BaldeStats = { start_time: string; data?: { value: string; count: number | string }[] }

// Contagem de eventos do pixel por hora, entre `de` e `ate` (dias de São Paulo, inclusive).
// O Meta devolve baldes de 1 hora em UTC; quem chama soma por dia no fuso certo.
export async function* estatisticasPixel(ctx: Contexto, pixelId: string, de: string, ate: string) {
  const inicio = Math.floor(new Date(`${de}T00:00:00-03:00`).getTime() / 1000)
  const fim = Math.floor(new Date(`${ate}T23:59:59-03:00`).getTime() / 1000) + 1
  const params = { aggregation: 'event', start_time: String(inicio), end_time: String(fim), limit: '500' }
  for await (const p of paginar<BaldeStats>(ctx, `${pixelId}/stats`, params)) {
    yield {
      limite: p.limite,
      baldes: p.itens.map((b) => ({ inicio: b.start_time, eventos: (b.data ?? []).map((e) => ({ evento: e.value, quantidade: Number(e.count) || 0 })) })),
    }
  }
}

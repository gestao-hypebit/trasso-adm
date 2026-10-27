// Funil por marca (cálculos puros). As etapas ficam em anuncio_marcas.funil.
//
// Duas leituras do mesmo funil:
//   anuncios → só quem veio de anúncio: entrega (impressões, cliques), eventos do
//              pixel atribuídos aos anúncios (campo actions dos insights) e os
//              eventos reais dos produtos de clientes vindos de anúncio.
//   site     → todo o tráfego: contagem dos pixels (estatísticas do pixel) e os
//              eventos reais de todos os clientes. Etapas de entrega não existem aqui.

import type { ClienteFunil, Metrica } from '@/lib/anuncios/regras'

export type Etapa = { rotulo: string; evento: string; lateral?: boolean }
export type Fonte = 'anuncios' | 'site'

export type PixelDia = { data: string; evento: string; quantidade: number }

// Eventos padrão do Meta Pixel (os que aparecem pelo nome nos insights dos anúncios).
export const EVENTOS_PADRAO = [
  'PageView', 'ViewContent', 'Search', 'Contact', 'Lead', 'InitiateCheckout', 'AddToCart', 'AddPaymentInfo',
  'CompleteRegistration', 'StartTrial', 'Subscribe', 'Purchase', 'Schedule', 'SubmitApplication',
]

export const EVENTOS_ENTREGA = [
  { evento: 'impressoes', rotulo: 'Impressões' },
  { evento: 'cliques', rotulo: 'Cliques no link' },
]

export const EVENTOS_PRODUTO = [
  { evento: 'produto:cadastro', rotulo: 'Cadastro (real)' },
  { evento: 'produto:ativacao', rotulo: 'Ativação (real)' },
  { evento: 'produto:assinatura', rotulo: 'Assinatura (real)' },
]

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

// Nomes com que o Meta devolve um evento do pixel em `actions`. O mesmo evento
// vem repetido (agregado, pixel, omni): vale o maior.
export function tiposDeAcao(eventoPixel: string): string[] {
  if (eventoPixel === 'PageView') return ['landing_page_view', 'omni_landing_page_view']
  const s = snake(eventoPixel)
  const tipos = [s, `offsite_conversion.fb_pixel_${s}`, `omni_${s}`, `${s}_total`]
  if (eventoPixel === 'Lead') tipos.push('onsite_conversion.lead_grouped')
  if (eventoPixel === 'InitiateCheckout') tipos.push('omni_initiated_checkout')
  return tipos
}

// Etapa que não existe numa fonte fica de fora do funil dessa fonte.
export function etapaSeAplica(etapa: Etapa, fonte: Fonte) {
  if (fonte === 'site') return etapa.evento.startsWith('pixel:') || etapa.evento.startsWith('produto:')
  return true
}

const naJanela = (dia: string | null, de: string, ate: string) => !!dia && dia >= de && dia <= ate

function contarProduto(tipo: string, clientes: ClienteFunil[], de: string, ate: string) {
  const campo = tipo === 'cadastro' ? 'cadastro' : tipo === 'ativacao' ? 'primeira_ativacao' : tipo === 'assinatura' ? 'primeira_assinatura' : null
  if (!campo) return 0
  return clientes.filter((c) => naJanela(c[campo], de, ate)).length
}

// Quantidade de uma etapa no período.
//   anuncios: `clientes` já deve vir filtrado para os clientes de anúncio do recorte.
//   site:     `pixel` são as contagens dos pixels da marca; `clientes` todos da marca.
export function contarEtapa(etapa: Etapa, fonte: Fonte, dados: { metricas: Metrica[]; pixel: PixelDia[]; clientes: ClienteFunil[] }, de: string, ate: string) {
  const { metricas, pixel, clientes } = dados
  const i = etapa.evento.indexOf(':')
  const tipo = i < 0 ? etapa.evento : etapa.evento.slice(0, i)
  const nome = i < 0 ? '' : etapa.evento.slice(i + 1)
  if (tipo === 'produto') return contarProduto(nome, clientes, de, ate)

  if (fonte === 'site') {
    if (tipo !== 'pixel') return 0
    return pixel.reduce((s, p) => (p.evento === nome && p.data >= de && p.data <= ate ? s + p.quantidade : s), 0)
  }

  let total = 0
  const tipos = tipo === 'pixel' ? tiposDeAcao(nome) : tipo === 'acao' ? [nome] : []
  for (const m of metricas) {
    if (m.data < de || m.data > ate) continue
    if (tipo === 'impressoes') total += Number(m.impressions)
    else if (tipo === 'cliques') total += Number(m.inline_link_clicks)
    else if (m.actions) total += Math.max(0, ...tipos.map((t) => m.actions![t] ?? 0))
  }
  return total
}

export type EtapaCalculada = Etapa & {
  valor: number
  taxa: number | null       // ÷ etapa principal anterior
  doTopo: number | null     // ÷ primeira etapa
  custo: number | null      // gasto ÷ valor (só no funil de anúncios)
}

export function calcularFunil(etapas: Etapa[], fonte: Fonte, dados: { metricas: Metrica[]; pixel: PixelDia[]; clientes: ClienteFunil[] }, de: string, ate: string): EtapaCalculada[] {
  const gasto = fonte === 'anuncios'
    ? dados.metricas.reduce((s, m) => (m.data >= de && m.data <= ate ? s + Number(m.spend) : s), 0)
    : 0
  const clientes = fonte === 'anuncios' ? dados.clientes.filter((c) => c.de_anuncio) : dados.clientes
  const out: EtapaCalculada[] = []
  let anterior: number | null = null
  let topo: number | null = null
  for (const etapa of etapas.filter((e) => etapaSeAplica(e, fonte))) {
    const valor = contarEtapa(etapa, fonte, { ...dados, clientes }, de, ate)
    topo ??= valor
    out.push({
      ...etapa,
      valor,
      taxa: anterior ? valor / anterior : null,
      doTopo: topo && out.length ? valor / topo : null,
      custo: fonte === 'anuncios' && valor > 0 && gasto > 0 ? gasto / valor : null,
    })
    if (!etapa.lateral) anterior = valor
  }
  return out
}

// Rótulo legível de um evento (para o editor das etapas).
export function rotuloEvento(evento: string) {
  const fixo = [...EVENTOS_ENTREGA, ...EVENTOS_PRODUTO].find((e) => e.evento === evento)
  if (fixo) return fixo.rotulo
  if (evento.startsWith('pixel:')) return `Pixel · ${evento.slice(6)}`
  if (evento.startsWith('acao:')) return `Ação do Meta · ${evento.slice(5)}`
  return evento
}

// Baldes de 1 hora das estatísticas do pixel → total por dia (São Paulo) e evento.
export function somarPixelPorDia(baldes: { inicio: string; eventos: { evento: string; quantidade: number }[] }[], diaSP: (iso: string) => string) {
  const mapa = new Map<string, PixelDia>()
  for (const b of baldes) {
    // O Meta manda "+0000" (sem dois-pontos); normaliza para ISO.
    const dia = diaSP(b.inicio.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
    for (const e of b.eventos) {
      const k = `${dia}|${e.evento}`
      const atual = mapa.get(k)
      if (atual) atual.quantidade += e.quantidade
      else mapa.set(k, { data: dia, evento: e.evento, quantidade: e.quantidade })
    }
  }
  return [...mapa.values()]
}

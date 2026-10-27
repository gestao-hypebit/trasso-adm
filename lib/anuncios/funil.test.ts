import { describe, expect, it } from 'vitest'
import { calcularFunil, somarPixelPorDia, tiposDeAcao, type Etapa } from '@/lib/anuncios/funil'
import { diaSP, type ClienteFunil, type Metrica } from '@/lib/anuncios/regras'

const met = (p: Partial<Metrica>): Metrica => ({
  data: '2026-10-10', campaign_id: 'c1', ad_id: 'a1', ad_name: null, campaign_name: null,
  spend: 100, impressions: 10000, clicks: 300, inline_link_clicks: 200, actions: null, ...p,
})
const cli = (p: Partial<ClienteFunil>): ClienteFunil => ({
  chave: 'x', marca_id: 'cp', de_anuncio: true, ad_id: null, campaign_id: null,
  cadastro: null, primeira_ativacao: null, primeira_assinatura: null, mrr: 0, ...p,
})

const CP: Etapa[] = [
  { rotulo: 'Impressões', evento: 'impressoes' },
  { rotulo: 'Cliques', evento: 'cliques' },
  { rotulo: 'Viu a página', evento: 'pixel:PageView' },
  { rotulo: 'Teste grátis', evento: 'pixel:InitiateCheckout' },
  { rotulo: 'Cadastrou', evento: 'produto:cadastro' },
  { rotulo: 'Assinou', evento: 'produto:assinatura' },
]

describe('funil dos anúncios', () => {
  const metricas = [
    met({ actions: { landing_page_view: 150, initiate_checkout: 40, 'offsite_conversion.fb_pixel_initiate_checkout': 40 } }),
    met({ data: '2026-10-11', spend: 50, impressions: 5000, inline_link_clicks: 100, actions: { landing_page_view: 50, omni_initiated_checkout: 10 } }),
  ]
  const clientes = [
    cli({ chave: 'a', cadastro: '2026-10-10', primeira_assinatura: '2026-10-12' }),
    cli({ chave: 'b', cadastro: '2026-10-11' }),
    cli({ chave: 'c', cadastro: '2026-10-11', de_anuncio: false }), // orgânico: fora
    cli({ chave: 'd', cadastro: '2026-09-01' }),                     // fora do período
  ]

  it('soma cada etapa sem contar duas vezes o mesmo evento', () => {
    const f = calcularFunil(CP, 'anuncios', { metricas, pixel: [], clientes }, '2026-10-01', '2026-10-31')
    expect(f.map((e) => e.valor)).toEqual([15000, 300, 200, 50, 2, 1])
    expect(f[1].taxa).toBe(300 / 15000)
    expect(f[3].taxa).toBe(50 / 200)
    expect(f[3].custo).toBe(150 / 50)
    expect(f[5].doTopo).toBe(1 / 15000)
    expect(f[0].taxa).toBeNull()
  })

  it('etapa lateral não vira a base da seguinte', () => {
    const slick: Etapa[] = [
      { rotulo: 'Viu a página', evento: 'pixel:PageView' },
      { rotulo: 'WhatsApp', evento: 'pixel:Contact', lateral: true },
      { rotulo: 'Formulário', evento: 'produto:cadastro' },
    ]
    const f = calcularFunil(slick, 'anuncios', { metricas: [met({ actions: { landing_page_view: 100, contact: 20 } })], pixel: [], clientes: [cli({ cadastro: '2026-10-10' })] }, '2026-10-01', '2026-10-31')
    expect(f[1].taxa).toBe(0.2)
    expect(f[2].taxa).toBe(0.01) // sobre "Viu a página", não sobre o WhatsApp
  })
})

describe('funil do site', () => {
  it('usa as contagens do pixel, todos os clientes e ignora etapas de entrega', () => {
    const pixel = [
      { data: '2026-10-10', evento: 'PageView', quantidade: 1000 },
      { data: '2026-10-11', evento: 'PageView', quantidade: 500 },
      { data: '2026-10-10', evento: 'InitiateCheckout', quantidade: 90 },
    ]
    const clientes = [cli({ cadastro: '2026-10-10' }), cli({ cadastro: '2026-10-11', de_anuncio: false })]
    const f = calcularFunil(CP, 'site', { metricas: [], pixel, clientes }, '2026-10-01', '2026-10-31')
    expect(f.map((e) => e.rotulo)).toEqual(['Viu a página', 'Teste grátis', 'Cadastrou', 'Assinou'])
    expect(f.map((e) => e.valor)).toEqual([1500, 90, 2, 0])
    expect(f.every((e) => e.custo === null)).toBe(true)
  })

  it('baldes de hora em UTC viram dias de São Paulo', () => {
    const dias = somarPixelPorDia([
      { inicio: '2026-10-11T02:00:00+0000', eventos: [{ evento: 'PageView', quantidade: 5 }] }, // 23h do dia 10 em SP
      { inicio: '2026-10-11T03:00:00+0000', eventos: [{ evento: 'PageView', quantidade: 7 }] }, // 0h do dia 11
      { inicio: '2026-10-11T04:00:00+0000', eventos: [{ evento: 'PageView', quantidade: 1 }, { evento: 'Lead', quantidade: 2 }] },
    ], diaSP)
    expect(dias).toEqual([
      { data: '2026-10-10', evento: 'PageView', quantidade: 5 },
      { data: '2026-10-11', evento: 'PageView', quantidade: 8 },
      { data: '2026-10-11', evento: 'Lead', quantidade: 2 },
    ])
  })

  it('nomes de ação do Meta para cada evento do pixel', () => {
    expect(tiposDeAcao('CompleteRegistration')).toContain('offsite_conversion.fb_pixel_complete_registration')
    expect(tiposDeAcao('PageView')).toContain('landing_page_view')
  })
})

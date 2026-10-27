import { describe, expect, it } from 'vitest'
import {
  acoesParaMapa, clientesDoFunil, conversoesMeta, diaSP, limparSegredos, marcaPorPrefixo, porGrupo, proximaJanela, resumir,
  type Evento, type Metrica,
} from '@/lib/anuncios/regras'
import { instante, paraLinha, eventoSchema, hashChave } from '@/lib/anuncios/eventos'

const MARCAS = [
  { id: 'cp', prefixos: ['CP', 'Catálogo Place', 'Catalogo Place', 'Catalogfy'] },
  { id: 'slick', prefixos: ['SLICK', 'TRASSO'] },
  { id: 'clubelly', prefixos: ['CLUBELLY'] },
]

describe('campanha → marca pelo prefixo', () => {
  it('reconhece o padrão novo e os nomes antigos', () => {
    expect(marcaPorPrefixo('CP | VENDAS | SITE', MARCAS)).toBe('cp')
    expect(marcaPorPrefixo('Catalogfy | VENDAS | SITE', MARCAS)).toBe('cp')
    expect(marcaPorPrefixo('Catalogo Place | CADASTRO SITE | TESTE GRATIS', MARCAS)).toBe('cp')
    expect(marcaPorPrefixo('catálogo place - remarketing', MARCAS)).toBe('cp')
    expect(marcaPorPrefixo('TRASSO | Leads | Site', MARCAS)).toBe('slick')
    expect(marcaPorPrefixo('slick|LEADS|lp', MARCAS)).toBe('slick')
    expect(marcaPorPrefixo('CLUBELLY', MARCAS)).toBe('clubelly')
  })

  it('não casa no meio da palavra nem sem prefixo', () => {
    expect(marcaPorPrefixo('CPX | teste', MARCAS)).toBeNull()
    expect(marcaPorPrefixo('Envelope Lacrado - Conversão', MARCAS)).toBeNull()
    expect(marcaPorPrefixo('Campanha CP | x', MARCAS)).toBeNull()
  })

  it('o prefixo mais longo vence', () => {
    expect(marcaPorPrefixo('CP Extra | x', [{ id: 'a', prefixos: ['CP'] }, { id: 'b', prefixos: ['CP Extra'] }])).toBe('b')
  })
})

describe('janelas de sincronização', () => {
  it('primeira carga começa 89 dias atrás em blocos de 10', () => {
    expect(proximaJanela('2026-10-27', null, false)).toEqual({ de: '2026-07-30', ate: '2026-08-08', carga: true })
  })
  it('continua de onde parou e para em hoje', () => {
    expect(proximaJanela('2026-10-27', '2026-10-21', false)).toEqual({ de: '2026-10-21', ate: '2026-10-27', carga: true })
  })
  it('depois da carga, sempre os últimos 7 dias', () => {
    expect(proximaJanela('2026-10-27', null, true)).toEqual({ de: '2026-10-21', ate: '2026-10-27', carga: false })
  })
})

describe('dados do Meta', () => {
  it('converte actions e conta conversão sem duplicar nomes equivalentes', () => {
    const a = acoesParaMapa([
      { action_type: 'lead', value: '3' },
      { action_type: 'offsite_conversion.fb_pixel_lead', value: '3' },
      { action_type: 'complete_registration', value: '2' },
      { action_type: 'link_click', value: '40' },
    ])
    expect(a.link_click).toBe(40)
    expect(conversoesMeta(a)).toBe(5)
  })

  it('tira o token de mensagens de erro', () => {
    const token = 'EAAG' + 'x'.repeat(60)
    const msg = limparSegredos(`falhou em https://graph.facebook.com/v26.0/act_1/insights?access_token=${token}&a=1 (${token})`, [token])
    expect(msg).not.toContain(token)
    expect(msg).toContain('access_token=[oculto]')
    expect(limparSegredos('Authorization: Bearer abc.def-123')).toBe('Authorization: Bearer [oculto]')
  })

  it('dia em São Paulo', () => {
    expect(diaSP('2026-10-28T02:30:00Z')).toBe('2026-10-27') // 23:30 em SP
  })
})

const ev = (p: Partial<Evento>): Evento => ({
  marca_id: 'cp', tipo: 'cadastro', cliente_ref: 'c1', ocorrido_em: '2026-10-10T15:00:00Z', valor: null,
  ad_id: null, campaign_id: null, de_anuncio: false, ...p,
})
const met = (p: Partial<Metrica>): Metrica => ({
  data: '2026-10-10', campaign_id: 'camp1', ad_id: 'ad1', ad_name: 'Anúncio 1', campaign_name: 'CP | VENDAS',
  spend: 100, impressions: 1000, clicks: 30, inline_link_clicks: 20, actions: null, ...p,
})

describe('funil e métricas', () => {
  const eventos: Evento[] = [
    // c1: veio do anúncio ad1, assinou e continua
    ev({ cliente_ref: 'c1', ad_id: 'ad1', campaign_id: 'camp1', de_anuncio: true }),
    ev({ cliente_ref: 'c1', tipo: 'assinatura', valor: 99, ocorrido_em: '2026-10-12T15:00:00Z' }),
    // c2: veio de anúncio (só utm), assinou e cancelou
    ev({ cliente_ref: 'c2', de_anuncio: true }),
    ev({ cliente_ref: 'c2', tipo: 'assinatura', valor: 49, ocorrido_em: '2026-10-11T15:00:00Z' }),
    ev({ cliente_ref: 'c2', tipo: 'cancelamento', ocorrido_em: '2026-10-20T15:00:00Z' }),
    // c3: orgânico
    ev({ cliente_ref: 'c3' }),
    ev({ cliente_ref: 'c3', tipo: 'assinatura', valor: 99 }),
    // c4: anúncio, mas cadastrou antes do período
    ev({ cliente_ref: 'c4', ocorrido_em: '2026-09-01T15:00:00Z', ad_id: 'ad1', campaign_id: 'camp1', de_anuncio: true }),
  ]
  const clientes = clientesDoFunil(eventos)

  it('origem do cliente vem do primeiro evento de anúncio', () => {
    const c1 = clientes.find((c) => c.chave === 'cp:c1')!
    expect(c1).toMatchObject({ de_anuncio: true, ad_id: 'ad1', campaign_id: 'camp1', mrr: 99, primeira_assinatura: '2026-10-12' })
    expect(clientes.find((c) => c.chave === 'cp:c2')!.mrr).toBe(0)
    expect(clientes.find((c) => c.chave === 'cp:c3')!.de_anuncio).toBe(false)
  })

  it('resumo do período: só clientes de anúncio contam', () => {
    const r = resumir([met({}), met({ data: '2026-10-11', spend: 50, impressions: 500, inline_link_clicks: 5 })], clientes, '2026-10-01', '2026-10-31')
    expect(r.gasto).toBe(150)
    expect(r.cadastros).toBe(2)        // c1 e c2 (c4 foi em setembro, c3 orgânico)
    expect(r.assinaturas).toBe(2)
    expect(r.custoPorCadastro).toBe(75)
    expect(r.cac).toBe(75)
    expect(r.mrr).toBe(99)             // c2 cancelou
    expect(r.ctr).toBeCloseTo(25 / 1500)
  })

  it('sem resultado, custos ficam nulos (não infinito)', () => {
    const r = resumir([met({})], [], '2026-10-01', '2026-10-31')
    expect(r.cac).toBeNull()
    expect(r.custoPorCadastro).toBeNull()
  })

  it('por campanha: atribui pelo campaign_id de origem', () => {
    const linhas = porGrupo([met({}), met({ campaign_id: 'camp2', ad_id: 'ad2', spend: 10 })], clientes, '2026-10-01', '2026-10-31', 'campaign')
    expect(linhas.map((l) => l.id)).toEqual(['camp1', 'camp2'])
    expect(linhas[0]).toMatchObject({ cadastros: 1, assinaturas: 1 })
    expect(linhas[1]).toMatchObject({ cadastros: 0, assinaturas: 0 })
  })
})

describe('eventos recebidos', () => {
  const base = { marca: 'catalogo-place', tipo: 'cadastro', cliente_id: 123, data: '2026-10-27T10:00:00-03:00' }

  it('valida e monta a linha; utm_content numérico vira ad_id', () => {
    const r = eventoSchema.safeParse({ ...base, utm_source: 'meta', utm_content: '120212345678901', utm_campaign: '120200000000001' })
    expect(r.success).toBe(true)
    const linha = paraLinha(r.data!, 'm1')
    expect(linha).toMatchObject({ cliente_ref: '123', ad_id: '120212345678901', campaign_id: '120200000000001', ocorrido_em: '2026-10-27T13:00:00.000Z' })
    expect(linha.evento_id).toBe('cadastro:123:2026-10-27T13:00:00.000Z')
  })

  it('assinatura sem valor, data ruim e ad_id não numérico são rejeitados', () => {
    expect(eventoSchema.safeParse({ ...base, tipo: 'assinatura' }).success).toBe(false)
    expect(eventoSchema.safeParse({ ...base, data: 'ontem' }).success).toBe(false)
    expect(eventoSchema.safeParse({ ...base, ad_id: 'abc' }).success).toBe(false)
    expect(eventoSchema.safeParse({ ...base, tipo: 'compra' }).success).toBe(false)
  })

  it('data sem fuso é horário de Brasília', () => {
    expect(instante('2026-10-27')).toBe('2026-10-27T03:00:00.000Z')
    expect(instante('2026-10-27T10:00')).toBe('2026-10-27T13:00:00.000Z')
  })

  it('hash da chave é estável', () => {
    expect(hashChave('slk_abc')).toBe(hashChave('slk_abc'))
    expect(hashChave('slk_abc')).toHaveLength(64)
  })
})

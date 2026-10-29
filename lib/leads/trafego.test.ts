import { describe, expect, it } from 'vitest'
import {
  comTemperatura, custoPor, ehTrafegoPago, horasAtePrimeiroContato, mediana, pontuacaoDoLead, resumoCampanhas, temperaturaDoLead,
  type LeadTrafego,
} from '@/lib/leads/trafego'
import { canalDoLead } from '@/lib/leads/funil'
import { normalizarUtm } from '@/lib/leads/utm'

const lead = (p: Partial<LeadTrafego> = {}): LeadTrafego => ({
  id: 'l1', status: 'novo', origem: 'landing-planejadores', utm: null, respostas: [], valor_estimado: 947,
  created_at: '2026-10-20T12:00:00Z', ...p,
})
const quente = [{ chave: 'classificacao', rotulo: 'Classificação', valor: 'quente' }, { chave: 'pontuacao', rotulo: 'Pontuação', valor: '8' }]

describe('UTM', () => {
  it('aceita o formato antigo do site (sem prefixo) e o novo', () => {
    expect(normalizarUtm({ source: 'meta', campaign: '123' })).toEqual({ utm_source: 'meta', utm_campaign: '123' })
    expect(normalizarUtm({ utm_source: 'meta', fbclid: 'abc' })).toEqual({ utm_source: 'meta', fbclid: 'abc' })
    expect(normalizarUtm(null)).toEqual({})
  })

  it('canal mostra a fonte também para leads das landings', () => {
    expect(canalDoLead({ origem: 'landing-planejadores', utm: { source: 'meta' } })).toBe('Landing · Planejadores · meta')
    expect(canalDoLead({ origem: 'site', utm: { utm_source: 'google' } })).toBe('Site · google')
    expect(canalDoLead({ origem: 'site', utm: null, formularios: { nome: 'Contato' } })).toBe('Site · Contato')
    expect(canalDoLead({ origem: 'indicacao', utm: null })).toBe('Indicação')
  })
})

describe('temperatura', () => {
  it('lê das respostas da landing', () => {
    expect(temperaturaDoLead(lead({ respostas: quente }))).toBe('quente')
    expect(pontuacaoDoLead(lead({ respostas: quente }))).toBe(8)
    expect(temperaturaDoLead(lead())).toBeNull()
  })

  it('troca a temperatura sem perder as outras respostas', () => {
    const r = comTemperatura([...quente, { chave: 'prazo', rotulo: 'Prazo', valor: 'Este mês' }], 'frio')
    expect(temperaturaDoLead({ respostas: r })).toBe('frio')
    expect(r.filter((x) => x.chave === 'classificacao')).toHaveLength(1)
    expect(r.some((x) => x.chave === 'prazo')).toBe(true)
    expect(temperaturaDoLead({ respostas: comTemperatura(r, null) })).toBeNull()
  })
})

describe('tráfego pago', () => {
  it('reconhece pela origem, pela fonte ou pelo fbclid', () => {
    expect(ehTrafegoPago({ origem: 'landing-planejadores', utm: null })).toBe(true)
    expect(ehTrafegoPago({ origem: 'site', utm: { source: 'Instagram' } })).toBe(true)
    expect(ehTrafegoPago({ origem: 'site', utm: { fbclid: 'x' } })).toBe(true)
    expect(ehTrafegoPago({ origem: 'indicacao', utm: null })).toBe(false)
  })

  it('cruza leads com o gasto da campanha (pelo id ou pelo nome)', () => {
    const campanhas = [{ campaign_id: '111', nome: 'SLICK | Planejadores' }, { campaign_id: '222', nome: 'SLICK | Teste' }]
    const gastos = [{ campaign_id: '111', spend: 100 }, { campaign_id: '111', spend: 50 }, { campaign_id: '222', spend: 30 }]
    const leads = [
      lead({ id: 'a', utm: { utm_campaign: '111' }, respostas: quente, status: 'convertido' }),
      lead({ id: 'b', utm: { utm_campaign: 'slick | planejadores' }, status: 'descartado' }),
      lead({ id: 'c' }),
    ]
    const historico = [{ lead_id: 'b', de: 'em_contato', para: 'qualificado', created_at: '2026-10-21T12:00:00Z' }]
    const r = resumoCampanhas(leads, historico, campanhas, gastos)

    const plan = r.campanhas.find((c) => c.chave === '111')!
    expect(plan).toMatchObject({ gasto: 150, leads: 2, quentes: 1, reunioes: 2, vendas: 1, receita: 947 })
    // Campanha que gastou e não trouxe lead continua no painel.
    expect(r.campanhas.find((c) => c.chave === '222')).toMatchObject({ gasto: 30, leads: 0 })
    expect(r.campanhas.find((c) => c.chave === 'sem-campanha')).toMatchObject({ leads: 1, gasto: null })
    expect(r.total).toMatchObject({ gasto: 180, leads: 3, vendas: 1 })
    expect(r.temperaturas.find((t) => t.temperatura === 'quente')).toMatchObject({ leads: 1, vendas: 1 })
  })

  it('custo e mediana', () => {
    expect(custoPor(150, 3)).toBe(50)
    expect(custoPor(0, 3)).toBeNull()
    expect(custoPor(150, 0)).toBeNull()
    expect(mediana([3, 1, 2])).toBe(2)
    expect(mediana([])).toBeNull()
  })

  it('tempo até o primeiro contato = primeira saída de "Novo"', () => {
    const h = [
      { lead_id: 'a', de: null, para: 'novo', created_at: '2026-10-20T12:00:00Z' },
      { lead_id: 'a', de: 'novo', para: 'em_contato', created_at: '2026-10-20T12:30:00Z' },
    ]
    expect(horasAtePrimeiroContato({ id: 'a', created_at: '2026-10-20T12:00:00Z' }, h)).toBe(0.5)
    expect(horasAtePrimeiroContato({ id: 'z', created_at: '2026-10-20T12:00:00Z' }, h)).toBeNull()
  })
})

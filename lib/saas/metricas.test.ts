import { describe, expect, it } from 'vitest'
import { CUSTO_AQUISICAO_RE, safras, unitario } from '@/lib/saas/metricas'

const m = (chave: string, data: string, status = 'recebido') => ({ chave, data, status })

describe('retenção por safra', () => {
  it('agrupa pelo mês da 1ª mensalidade e mede quem continuou', () => {
    const r = safras([
      // safra de junho: 2 clientes; um sai depois de julho
      m('a', '2026-06-10'), m('a', '2026-07-10'),
      m('b', '2026-06-12'), m('b', '2026-07-12'), m('b', '2026-08-12'), m('b', '2026-09-12'), m('b', '2026-10-12'),
      // safra de setembro
      m('c', '2026-09-05'),
    ], '2026-10-22')
    const junho = r.find((s) => s.mes === '2026-06')!
    expect(junho.clientes).toBe(2)
    expect(junho.retencao[1]).toBe(1)     // julho: os dois
    expect(junho.retencao[3]).toBe(0.5)   // setembro: só o b
    expect(junho.retencao[6]).toBeNull()  // dezembro ainda não chegou
    const setembro = r.find((s) => s.mes === '2026-09')!
    expect(setembro.retencao[1]).toBeNull() // outubro ainda está sendo cobrado
  })

  it('cancelado e mês futuro não contam; quem pulou um mês e voltou é retido', () => {
    const r = safras([
      m('a', '2026-05-10'), m('a', '2026-06-10', 'cancelado'), m('a', '2026-07-10'),
      m('z', '2026-12-10'),
    ], '2026-10-22')
    expect(r).toHaveLength(1)
    expect(r[0].retencao[1]).toBe(1)
  })
})

describe('unidade econômica', () => {
  it('LTV, CAC e payback', () => {
    const u = unitario({ ticket: 47.91, churn: 0.05, custoAquisicao: 300, novos: 10 })
    expect(u.vidaMeses).toBe(20)
    expect(u.ltv).toBeCloseTo(958.2)
    expect(u.cac).toBe(30)
    expect(u.payback).toBeCloseTo(0.63, 2)
    expect(u.ltvPorCac).toBeCloseTo(31.94, 2)
  })

  it('sem churn ou sem cliente novo, não inventa número', () => {
    const u = unitario({ ticket: 50, churn: 0, custoAquisicao: 100, novos: 0 })
    expect(u.ltv).toBeNull()
    expect(u.cac).toBeNull()
  })

  it('o que conta como custo de aquisição', () => {
    expect(CUSTO_AQUISICAO_RE.test('Marketing')).toBe(true)
    expect(CUSTO_AQUISICAO_RE.test('Tráfego pago')).toBe(true)
    expect(CUSTO_AQUISICAO_RE.test('Comissão de Indicação')).toBe(true)
    expect(CUSTO_AQUISICAO_RE.test('Contabilidade')).toBe(false)
  })
})

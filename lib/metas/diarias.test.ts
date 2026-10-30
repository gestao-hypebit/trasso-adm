import { describe, expect, it } from 'vitest'
import { resumirPeriodo, sequencia, ultimosDias, valeNoDia } from './diarias'

// 2026-10-30 é sexta-feira.
const util = { alvo: 40, dias_semana: [1, 2, 3, 4, 5] }

describe('valeNoDia', () => {
  it('respeita os dias da semana', () => {
    expect(valeNoDia(util, '2026-10-30')).toBe(true)
    expect(valeNoDia(util, '2026-10-31')).toBe(false)
  })
})

describe('sequencia', () => {
  it('conta os dias batidos e pula o fim de semana', () => {
    const feito = { '2026-10-30': 40, '2026-10-29': 45, '2026-10-26': 40, '2026-10-27': 40, '2026-10-28': 41, '2026-10-23': 40, '2026-10-22': 10 }
    expect(sequencia(util, feito, '2026-10-30')).toBe(6)
  })

  it('hoje ainda incompleto não quebra a sequência', () => {
    const feito = { '2026-10-30': 12, '2026-10-29': 40, '2026-10-28': 40 }
    expect(sequencia(util, feito, '2026-10-30')).toBe(2)
  })

  it('dia útil perdido zera', () => {
    expect(sequencia(util, { '2026-10-30': 40, '2026-10-28': 40 }, '2026-10-30')).toBe(1)
  })

  it('no sábado olha para a sexta', () => {
    expect(sequencia(util, { '2026-10-30': 40 }, '2026-10-31')).toBe(1)
  })
})

describe('resumirPeriodo', () => {
  it('soma total e taxa só nos dias que valem', () => {
    const dias = ultimosDias(7, '2026-10-30')
    expect(dias[0]).toBe('2026-10-24')
    const r = resumirPeriodo(util, { '2026-10-30': 40, '2026-10-29': 20, '2026-10-25': 5 }, dias)
    expect(r).toMatchObject({ validos: 5, batidos: 1, total: 65 })
    expect(r.taxa).toBeCloseTo(0.2)
  })
})

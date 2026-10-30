import { describe, expect, it } from 'vitest'
import { intervaloAnterior, intervaloDoPeriodo, noIntervalo, variacao } from './periodo'

describe('intervaloDoPeriodo', () => {
  it('conta os dias com as duas pontas', () => {
    expect(intervaloDoPeriodo('7d', '2026-10-29')).toEqual({ de: '2026-10-23', ate: '2026-10-29' })
    expect(intervaloDoPeriodo('hoje', '2026-10-29')).toEqual({ de: '2026-10-29', ate: '2026-10-29' })
  })

  it('este mês e mês passado, inclusive na virada do ano', () => {
    expect(intervaloDoPeriodo('mes', '2026-10-29')).toEqual({ de: '2026-10-01', ate: '2026-10-29' })
    expect(intervaloDoPeriodo('mes_passado', '2026-03-10')).toEqual({ de: '2026-02-01', ate: '2026-02-28' })
    expect(intervaloDoPeriodo('mes_passado', '2027-01-05')).toEqual({ de: '2026-12-01', ate: '2026-12-31' })
  })

  it('personalizado com datas invertidas troca as pontas', () => {
    expect(intervaloDoPeriodo('personalizado', '2026-10-29', { de: '2026-10-20', ate: '2026-10-01' })).toEqual({ de: '2026-10-01', ate: '2026-10-20' })
  })

  it('todo período não limita', () => {
    expect(intervaloDoPeriodo('tudo', '2026-10-29')).toEqual({ de: null, ate: null })
  })
})

describe('intervaloAnterior', () => {
  it('mesma duração, logo antes', () => {
    expect(intervaloAnterior({ de: '2026-10-23', ate: '2026-10-29' })).toEqual({ de: '2026-10-16', ate: '2026-10-22' })
    expect(intervaloAnterior({ de: null, ate: '2026-10-29' })).toBeNull()
  })
})

describe('noIntervalo e variacao', () => {
  it('pontas abertas e fechadas', () => {
    expect(noIntervalo('2026-10-01', { de: '2026-10-01', ate: '2026-10-31' })).toBe(true)
    expect(noIntervalo('2026-09-30', { de: '2026-10-01', ate: null })).toBe(false)
    expect(noIntervalo('2020-01-01', { de: null, ate: null })).toBe(true)
  })

  it('variação percentual', () => {
    expect(variacao(15, 10)).toBe(50)
    expect(variacao(5, 0)).toBeNull()
  })
})

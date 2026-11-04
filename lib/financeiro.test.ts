import { describe, expect, it } from 'vitest'
import { resumoRecebido, saldoDaConta } from '@/lib/financeiro'

describe('saldoDaConta', () => {
  it('soma o recebido, tira o pago e ignora o que não foi liquidado', () => {
    expect(saldoDaConta([
      { tipo: 'receita', valor: 1000, status: 'recebido' },
      { tipo: 'receita', valor: '250.50', status: 'recebido' },
      { tipo: 'despesa', valor: 300, status: 'pago' },
      { tipo: 'receita', valor: 999, status: 'pendente' },
      { tipo: 'despesa', valor: 999, status: 'pendente' },
      { tipo: 'receita', valor: 999, status: 'cancelado' },
    ])).toBe(950.5)
  })

  it('pode ficar negativo', () => {
    expect(saldoDaConta([{ tipo: 'despesa', valor: 80, status: 'pago' }])).toBe(-80)
  })
})

describe('resumoRecebido', () => {
  it('conta os recebimentos e soma os valores', () => {
    expect(resumoRecebido([{ valor: 97 }, { valor: '850.00' }, { valor: null }])).toEqual({ quantidade: 3, total: 947 })
  })

  it('dia sem recebimento', () => {
    expect(resumoRecebido([])).toEqual({ quantidade: 0, total: 0 })
  })
})

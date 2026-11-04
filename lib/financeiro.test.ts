import { describe, expect, it } from 'vitest'
import { pagamentosNovos, resumoRecebido, saldoDaConta } from '@/lib/financeiro'

describe('pagamentosNovos', () => {
  const asaas = { id: 'a', valor: 97, asaas_payment_id: 'pay_1' }
  const manual = { id: 'b', valor: 200, asaas_payment_id: null }

  it('só avisa do que veio do Asaas e ainda não tinha sido visto', () => {
    expect(pagamentosNovos(new Set(), [asaas, manual])).toEqual([asaas])
    expect(pagamentosNovos(new Set(['a']), [asaas, manual])).toEqual([])
  })

  it('lançamento manual já visto e depois ligado a uma cobrança não toca', () => {
    expect(pagamentosNovos(new Set(['b']), [{ ...manual, asaas_payment_id: 'pay_2' }])).toEqual([])
  })
})

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

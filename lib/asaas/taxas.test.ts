import { describe, expect, it } from 'vitest'
import { descontarAntecipacoes, formaAindaIndefinida, liquidoAntesDaAntecipacao } from '@/lib/asaas/taxas'

describe('formaAindaIndefinida', () => {
  it('vale para cobrança em aberto em que o cliente ainda escolhe a forma', () => {
    expect(formaAindaIndefinida({ billingType: 'UNDEFINED', status: 'PENDING' })).toBe(true)
    expect(formaAindaIndefinida({ billingType: 'UNDEFINED', status: 'OVERDUE' })).toBe(true)
  })

  it('não vale quando a forma já é conhecida', () => {
    expect(formaAindaIndefinida({ billingType: 'CREDIT_CARD', status: 'PENDING' })).toBe(false)
    expect(formaAindaIndefinida({ billingType: 'PIX', status: 'RECEIVED' })).toBe(false)
  })

  it('não vale para pagamento em dinheiro, que continua sem forma no Asaas', () => {
    expect(formaAindaIndefinida({ billingType: 'UNDEFINED', status: 'RECEIVED_IN_CASH' })).toBe(false)
  })
})

describe('liquidoAntesDaAntecipacao', () => {
  const cartao = { value: 49.9, netValue: 49.9, billingType: 'CREDIT_CARD' }

  it('usa o netValue atual quando ele ainda tem a taxa', () => {
    expect(liquidoAntesDaAntecipacao({ ...cartao, netValue: 47.92 }, [])).toBe(47.92)
  })

  it('recupera o líquido dos avisos quando o netValue subiu para o valor cheio', () => {
    expect(liquidoAntesDaAntecipacao(cartao, [
      { netValue: 47.92, billingType: 'CREDIT_CARD' },
      { netValue: 49.9, billingType: 'CREDIT_CARD' },
    ])).toBe(47.92)
  })

  it('ignora a estimativa do tempo em que a forma era indefinida', () => {
    expect(liquidoAntesDaAntecipacao(cartao, [
      { netValue: 47.91, billingType: 'UNDEFINED' },
      { netValue: 47.92, billingType: 'CREDIT_CARD' },
    ])).toBe(47.92)
    expect(liquidoAntesDaAntecipacao(cartao, [{ netValue: 47.91, billingType: 'UNDEFINED' }])).toBe(49.9)
  })
})

describe('descontarAntecipacoes', () => {
  it('desconta o custo da antecipação', () => {
    expect(descontarAntecipacoes(47.92, [{ fee: 1.1, status: 'CREDITED' }])).toBe(46.82)
  })

  it('não desconta antecipação negada ou cancelada', () => {
    expect(descontarAntecipacoes(47.92, [{ fee: 1.1, status: 'DENIED' }, { fee: 1.1, status: 'CANCELLED' }])).toBe(47.92)
  })

  it('mantém o líquido sem antecipações', () => {
    expect(descontarAntecipacoes(47.92, [])).toBe(47.92)
  })
})

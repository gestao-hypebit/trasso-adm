import { describe, expect, it } from 'vitest'
import { etapaDaRegua, proximoPasso, type EstadoAssinatura } from '@/lib/automacoes/regras'

const op = { primeiraExecucao: false, antigaAntesDe: '2026-08-22' }
const nova: EstadoAssinatura = { pagou: false, cancelada: false, criadaEm: '2026-10-11' }

describe('assinaturas → metas', () => {
  it('primeira execução: o que já existe vira ponto de partida, nada é lançado', () => {
    const r = proximoPasso(null, { pagou: true, cancelada: false, criadaEm: '2026-10-01' }, { ...op, primeiraExecucao: true })
    expect(r).toEqual({ registro: { novo_registrado: true, cancelamento_registrado: false }, novo: false, cancelamento: false })
    const cancelada = proximoPasso(null, { pagou: false, cancelada: true, criadaEm: '2025-01-01' }, { ...op, primeiraExecucao: true })
    expect(cancelada.cancelamento).toBe(false)
  })

  it('assinatura nova sem pagamento: só acompanha (caso do cliente que ainda não pagou)', () => {
    const r = proximoPasso(null, nova, op)
    expect(r.novo).toBe(false)
    expect(r.registro.novo_registrado).toBe(false)
  })

  it('1º pagamento vira cliente novo, uma vez só', () => {
    const primeira = proximoPasso({ novo_registrado: false, cancelamento_registrado: false }, { ...nova, pagou: true }, op)
    expect(primeira.novo).toBe(true)
    const depois = proximoPasso(primeira.registro, { ...nova, pagou: true }, op)
    expect(depois.novo).toBe(false)
  })

  it('cancelou depois de ser cliente: registra o cancelamento uma vez só', () => {
    const r = proximoPasso({ novo_registrado: true, cancelamento_registrado: false }, { ...nova, cancelada: true }, op)
    expect(r.cancelamento).toBe(true)
    expect(proximoPasso(r.registro, { ...nova, cancelada: true }, op).cancelamento).toBe(false)
  })

  it('criada e cancelada sem nunca pagar não é cancelamento', () => {
    const r = proximoPasso({ novo_registrado: false, cancelamento_registrado: false }, { ...nova, cancelada: true }, op)
    expect(r.cancelamento).toBe(false)
    expect(r.registro.cancelamento_registrado).toBe(true)
  })

  it('assinatura antiga que o sistema nunca viu não vira cliente novo', () => {
    const r = proximoPasso(null, { pagou: true, cancelada: false, criadaEm: '2025-03-01' }, op)
    expect(r.novo).toBe(false)
  })
})

describe('régua de cobrança', () => {
  it('3, 7 e 15 dias', () => {
    expect(etapaDaRegua(2)).toBeNull()
    expect(etapaDaRegua(3)).toBe(3)
    expect(etapaDaRegua(10)).toBe(7)
    expect(etapaDaRegua(40)).toBe(15)
  })
})

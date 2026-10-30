import { describe, expect, it } from 'vitest'
import { ETAPAS_FUNIL, etapaMaxima, type Historico } from './funil'

const h = (para: string, dia: number, de: string | null = null): Historico =>
  ({ lead_id: 'x', de, para, created_at: `2026-10-${String(dia).padStart(2, '0')}T12:00:00Z` })
const i = (etapa: string) => ETAPAS_FUNIL.indexOf(etapa as (typeof ETAPAS_FUNIL)[number])

describe('etapaMaxima', () => {
  it('lead em aberto vale pela etapa atual', () => {
    expect(etapaMaxima({ status: 'proposta' }, [h('novo', 1), h('em_contato', 2), h('qualificado', 3), h('proposta', 4)])).toBe(i('proposta'))
  })

  it('voltar para uma etapa anterior desfaz o avanço (correção)', () => {
    const hist = [h('novo', 1), h('em_contato', 2), h('qualificado', 3), h('novo', 4), h('em_contato', 5)]
    expect(etapaMaxima({ status: 'em_contato' }, hist)).toBe(i('em_contato'))
  })

  it('perdido vale pela etapa em que estava ao ser perdido', () => {
    const hist = [h('novo', 1), h('em_contato', 2), h('qualificado', 3), h('proposta', 4), h('descartado', 5)]
    expect(etapaMaxima({ status: 'descartado' }, hist)).toBe(i('proposta'))
  })

  it('perdido considera a ordem do histórico, mesmo vindo fora de ordem', () => {
    const hist = [h('descartado', 5), h('qualificado', 3), h('novo', 1), h('em_contato', 4)]
    expect(etapaMaxima({ status: 'descartado' }, hist)).toBe(i('em_contato'))
  })

  it('perdido sem histórico conta como novo', () => {
    expect(etapaMaxima({ status: 'descartado' }, [])).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { validarSiteLead } from './leads'
import { gerarChave, hashChave, PREFIXO_CHAVE } from './chave'

describe('validarSiteLead', () => {
  it('aceita nome + telefone e normaliza os campos extras', () => {
    const r = validarSiteLead({
      nome: '  Ana  ',
      telefone: '(91) 98404-7100',
      formulario: 'Agendar!',
      campos: { empresa: 'Padaria', melhor_periodo: 'Manhã', vazio: '' },
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.spam).toBe(false)
    expect(r.lead.nome).toBe('Ana')
    expect(r.lead.formulario).toBe('agendar')
    expect(r.lead.respostas).toEqual([
      { chave: 'empresa', rotulo: 'Empresa', valor: 'Padaria' },
      { chave: 'melhor_periodo', rotulo: 'Melhor periodo', valor: 'Manhã' },
    ])
  })

  it('aceita campos no formato de lista com rótulo', () => {
    const r = validarSiteLead({ nome: 'Ana', email: 'ANA@x.com', campos: [{ chave: 'servicos', rotulo: 'Serviços', valor: ['A', 'B'] }] })
    expect(r.ok && r.lead.email).toBe('ana@x.com')
    expect(r.ok && r.lead.respostas[0]).toEqual({ chave: 'servicos', rotulo: 'Serviços', valor: ['A', 'B'] })
  })

  it('exige nome e algum contato', () => {
    const r = validarSiteLead({ nome: '' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.erros.nome).toBeDefined()
    expect(r.erros.telefone).toBeDefined()
  })

  it('recusa e-mail inválido e telefone curto', () => {
    const r = validarSiteLead({ nome: 'Ana', email: 'ana@', telefone: '123' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.erros.email).toBeDefined()
    expect(r.erros.telefone).toBeDefined()
  })

  it('marca como spam quando a armadilha vem preenchida', () => {
    const r = validarSiteLead({ nome: 'Bot', email: 'bot@x.com', _hp: 'http://spam' })
    expect(r.ok && r.spam).toBe(true)
  })
})

describe('chave do site', () => {
  it('gera chaves únicas com prefixo e hash estável', async () => {
    const a = gerarChave()
    const b = gerarChave()
    expect(a.startsWith(PREFIXO_CHAVE)).toBe(true)
    expect(a).not.toBe(b)
    expect(await hashChave(a)).toBe(await hashChave(a))
    expect(await hashChave(a)).toMatch(/^[0-9a-f]{64}$/)
  })
})

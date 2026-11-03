import { describe, expect, it } from 'vitest'
import { copyComoTexto, resumoCopy, secaoTemConteudo } from './copy'

describe('copy do site', () => {
  it('resume o andamento: rascunho não conta como enviado', () => {
    const r = resumoCopy([{ status: 'rascunho' }, { status: 'aguardando' }, { status: 'aprovada' }, { status: 'ajustes' }])
    expect(r).toEqual({ total: 4, enviadas: 3, aprovadas: 1, aguardando: 1, ajustes: 1, paraEnviar: 2 })
  })

  it('só considera seção com texto preenchido', () => {
    expect(secaoTemConteudo({ campos: [{ _id: 'a', rotulo: 'Título', texto: '  ' }] })).toBe(false)
    expect(secaoTemConteudo({ campos: [{ _id: 'a', rotulo: 'Título', texto: 'Oi' }] })).toBe(true)
  })

  it('exporta como texto, pulando campos vazios', () => {
    const t = copyComoTexto([
      { titulo: 'Topo', campos: [{ _id: 'a', rotulo: 'Título', texto: 'Olá *mundo*' }, { _id: 'b', rotulo: 'Botão', texto: '' }] },
      { titulo: 'Sobre', campos: [{ _id: 'c', rotulo: '', texto: 'Texto livre' }] },
    ])
    expect(t).toBe('## Topo\n\nTítulo: Olá *mundo*\n\n\n## Sobre\n\nTexto livre')
  })
})

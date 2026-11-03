import { describe, expect, it } from 'vitest'
import { limparConteudo, problemasConteudo, validarEstrutura, valorAtual } from './conteudo'
import { urlDoSite } from './url'

const bruta = {
  versao: 1,
  secoes: [
    {
      id: 'hero', titulo: 'Topo',
      campos: [
        { id: 'titulo', tipo: 'texto', rotulo: 'Título', max: 20, padrao: 'Olá *mundo*' },
        { id: 'texto', tipo: 'textarea', rotulo: 'Texto' },
        { id: 'foto', tipo: 'imagem', rotulo: 'Foto', padrao: '/fotos/a.jpg' },
        { id: 'link', tipo: 'link', rotulo: 'Link' },
      ],
    },
    {
      id: 'faq', titulo: 'Dúvidas',
      campos: [{
        id: 'itens', tipo: 'lista', rotulo: 'Perguntas', itemRotulo: 'Pergunta', min: 1, maxItens: 2,
        campos: [{ id: 'p', tipo: 'texto', rotulo: 'Pergunta' }, { id: 'r', tipo: 'textarea', rotulo: 'Resposta' }],
        padrao: [{ _id: 'a', p: 'P1', r: 'R1' }],
      }],
    },
  ],
}

describe('validarEstrutura', () => {
  it('aceita uma estrutura correta e guarda os padrões da lista', () => {
    const e = validarEstrutura(bruta)
    expect(e.secoes).toHaveLength(2)
    const lista = e.secoes[1].campos[0]
    expect(lista.tipo).toBe('lista')
    expect(lista.tipo === 'lista' && lista.padrao).toEqual([{ _id: 'a', p: 'P1', r: 'R1' }])
  })

  it('recusa ids inválidos, repetidos, tipos desconhecidos e lista dentro de lista', () => {
    expect(() => validarEstrutura({ secoes: [{ id: 'Hero!', campos: [{ id: 'a', tipo: 'texto' }] }] })).toThrow()
    expect(() => validarEstrutura({ secoes: [{ id: 'a', campos: [{ id: 'x', tipo: 'texto' }, { id: 'x', tipo: 'texto' }] }] })).toThrow()
    expect(() => validarEstrutura({ secoes: [{ id: 'a', campos: [{ id: 'x', tipo: 'html' }] }] })).toThrow()
    expect(() => validarEstrutura({ secoes: [{ id: 'a', campos: [{ id: 'l', tipo: 'lista', campos: [{ id: 'y', tipo: 'lista' }] }] }] })).toThrow()
    expect(() => validarEstrutura({ secoes: [] })).toThrow()
  })
})

describe('limparConteudo', () => {
  const e = validarEstrutura(bruta)

  it('mantém só o que a estrutura prevê e respeita os limites', () => {
    const c = limparConteudo(e, {
      hero: { titulo: 'x'.repeat(50), extra: 'some', texto: 'linha 1\r\nlinha 2' },
      intruso: { a: 'b' },
    })
    expect(Object.keys(c)).toEqual(['hero'])
    expect(c.hero.titulo).toHaveLength(20)
    expect(c.hero.texto).toBe('linha 1\nlinha 2')
    expect(c.hero.extra).toBeUndefined()
  })

  it('texto curto não aceita quebra de linha', () => {
    expect(limparConteudo(e, { hero: { titulo: 'a\nb' } }).hero.titulo).toBe('a b')
  })

  it('bloqueia links e imagens perigosos', () => {
    const c = limparConteudo(e, { hero: { link: 'javascript:alert(1)', foto: 'data:image/png;base64,xx' } })
    expect(c.hero).toBeUndefined()
    const ok = limparConteudo(e, { hero: { link: 'https://wa.me/55', foto: 'https://x.supabase.co/a.jpg' } })
    expect(ok.hero).toEqual({ link: 'https://wa.me/55', foto: 'https://x.supabase.co/a.jpg' })
  })

  it('limita a quantidade de itens, descarta campos estranhos e cria _id que falta', () => {
    const c = limparConteudo(e, { faq: { itens: [{ p: 'a', r: 'b', hack: '<script>' }, { _id: 'z', p: 'c' }, { p: 'd' }] } })
    const itens = c.faq.itens as { _id: string; p?: string; hack?: string }[]
    expect(itens).toHaveLength(2)
    expect(itens[0].hack).toBeUndefined()
    expect(itens[0]._id).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(itens[1]._id).toBe('z')
  })
})

describe('valorAtual e problemasConteudo', () => {
  const e = validarEstrutura(bruta)

  it('usa o padrão quando não há valor salvo', () => {
    expect(valorAtual({}, e.secoes[0], e.secoes[0].campos[0])).toBe('Olá *mundo*')
    expect(valorAtual({ hero: { titulo: 'Novo' } }, e.secoes[0], e.secoes[0].campos[0])).toBe('Novo')
  })

  it('aponta lista abaixo do mínimo', () => {
    expect(problemasConteudo(e, {})).toEqual([])
    expect(problemasConteudo(e, { faq: { itens: [] } })).toHaveLength(1)
  })
})

describe('urlDoSite', () => {
  it('usa https, menos para localhost', () => {
    expect(urlDoSite('site-perfomei.vercel.app')).toBe('https://site-perfomei.vercel.app')
    expect(urlDoSite('localhost:3002')).toBe('http://localhost:3002')
    expect(urlDoSite('https://x.com/')).toBe('https://x.com')
  })
})

import { describe, expect, it } from 'vitest'
import { MODELOS_BRIEFING, errosDoBriefing, etapasDoModelo, limparRespostas, mensagemWhatsappBriefing, modelosDaArea, textoRespostas } from '@/lib/social/briefing'

const NOVO_OK = {
  nome_loja: 'Loja da Ana', responsavel: 'Ana', whatsapp: '(11) 98765-4321',
  sugestoes_arroba: '@lojadaana', produtos: 'Roupas femininas',
}

describe('modelos', () => {
  it('chaves únicas e escolhas com opções', () => {
    for (const { perguntas } of Object.values(MODELOS_BRIEFING)) {
      expect(new Set(perguntas.map((q) => q.chave)).size).toBe(perguntas.length)
      for (const q of perguntas) expect(!!q.opcoes?.length).toBe(q.tipo === 'escolha_unica' || q.tipo === 'multipla_escolha')
    }
  })

  it('agrupa em etapas na ordem', () => {
    expect(etapasDoModelo('perfil_existente').map((e) => e.titulo)).toEqual(['Sobre a loja', 'Produtos', 'Público', 'O Instagram hoje', 'Objetivos'])
    expect(etapasDoModelo('perfil_novo').map((e) => e.titulo)).toEqual(['Sobre a loja', 'O perfil', 'Como você vende', 'Produtos', 'Estilo do perfil'])
  })
})

describe('errosDoBriefing', () => {
  it('aponta os obrigatórios faltando', () => {
    expect(Object.keys(errosDoBriefing('perfil_novo', {}))).toEqual(['nome_loja', 'responsavel', 'whatsapp', 'sugestoes_arroba', 'produtos'])
    expect(errosDoBriefing('perfil_existente', {}).objetivo).toBe('Escolha pelo menos uma opção.')
  })

  it('passa com os obrigatórios preenchidos', () => {
    expect(errosDoBriefing('perfil_novo', NOVO_OK)).toEqual({})
  })

  it('valida telefone e e-mail', () => {
    const erros = errosDoBriefing('perfil_novo', { ...NOVO_OK, whatsapp: '9876', email_cadastro: 'ana@' })
    expect(erros).toEqual({ whatsapp: 'Informe o número com DDD.', email_cadastro: 'Confira o e-mail.' })
  })
})

describe('limparRespostas', () => {
  it('descarta chaves de fora do modelo, opções inventadas e tipos errados', () => {
    const limpo = limparRespostas('perfil_novo', {
      ...NOVO_OK,
      instagram_atual: '@outra',            // é do outro modelo
      cliente_id: 'x', status: 'respondido', // tentativa de gravar outra coisa
      logo: 'Opção falsa',
      pagamento: ['Pix', 'Pix', 'Bitcoin', 3],
      cores: ['azul'],
      historia: '   ',
    })
    expect(limpo).toEqual({ ...NOVO_OK, pagamento: ['Pix'] })
  })

  it('corta textos longos', () => {
    const limpo = limparRespostas('perfil_novo', { nome_loja: 'a'.repeat(1000), historia: 'b'.repeat(9000) })
    expect((limpo.nome_loja as string).length).toBe(300)
    expect((limpo.historia as string).length).toBe(5000)
  })

  it('aceita entrada que não é objeto', () => {
    expect(limparRespostas('perfil_existente', null)).toEqual({})
    expect(limparRespostas('perfil_existente', 'texto')).toEqual({})
  })
})

describe('textoRespostas', () => {
  it('organiza por etapa e marca as vazias', () => {
    const texto = textoRespostas('Loja da Ana', { modelo: 'perfil_novo', respostas: { ...NOVO_OK, pagamento: ['Pix', 'Cartão'] }, respondido_em: null })
    expect(texto.split('\n')[0]).toBe('Briefing · Loja da Ana · Perfil novo')
    expect(texto).toContain('## 3. Como você vende')
    expect(texto).toContain('- Formas de pagamento: Pix, Cartão')
    expect(texto).toContain('- Cores da marca: —')
  })
})

describe('briefing de site', () => {
  it('fica separado dos modelos de social', () => {
    expect(modelosDaArea('social')).toEqual(['perfil_novo', 'perfil_existente'])
    expect(modelosDaArea('site')).toEqual(['site'])
  })

  it('obrigatórios e etapas', () => {
    expect(etapasDoModelo('site').map((e) => e.titulo)).toEqual(['Sobre a empresa', 'O site', 'Conteúdo', 'Visual', 'Contato e lançamento'])
    expect(Object.keys(errosDoBriefing('site', {}))).toEqual(['nome_empresa', 'responsavel', 'whatsapp', 'descricao', 'objetivo', 'servicos'])
    expect(errosDoBriefing('site', {
      nome_empresa: 'Clínica Sorriso', responsavel: 'Ana', whatsapp: '(11) 98765-4321',
      descricao: 'Odontologia', objetivo: ['Aparecer no Google'], servicos: 'Implante',
    })).toEqual({})
  })

  it('mensagem do WhatsApp fala do site', () => {
    expect(mensagemWhatsappBriefing('Ana', 'https://x/briefing/1', 'site')).toContain('seu site')
    expect(mensagemWhatsappBriefing('Ana', 'https://x/briefing/1', 'perfil_novo')).toContain('Instagram')
  })
})

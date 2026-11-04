import { describe, expect, it } from 'vitest'
import { MODELOS_BRIEFING, errosDoBriefing, etapasDoModelo, gerarChave, limparRespostas, mensagemWhatsappBriefing, modelosDaArea, normalizarPerguntas, perguntasDoBriefing, problemaNasPerguntas, textoRespostas } from '@/lib/social/briefing'

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
    expect(modelosDaArea('social')).toEqual(['perfil_novo', 'perfil_existente', 'empresa'])
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

describe('briefing de empresa', () => {
  it('obrigatórios e etapas', () => {
    expect(etapasDoModelo('empresa').map((e) => e.titulo)).toEqual(['Sobre a empresa', 'O que você oferece', 'Seu cliente', 'Credibilidade e regras', 'O Instagram', 'Objetivos e estilo'])
    expect(Object.keys(errosDoBriefing('empresa', {}))).toEqual(['nome_empresa', 'responsavel', 'whatsapp', 'servicos', 'objetivo'])
  })

  it('não fala de loja com o cliente', () => {
    const { titulo, intro, perguntas } = MODELOS_BRIEFING.empresa
    const textos = [titulo, intro, ...perguntas.flatMap((q) => [q.rotulo, q.ajuda ?? '', q.placeholder ?? '', ...(q.opcoes ?? [])])]
    expect(textos.filter((t) => /\b(loja|produtos?)\b/i.test(t))).toEqual([])
    expect(mensagemWhatsappBriefing('Ana', 'https://x/briefing/1', 'empresa')).toContain('sua empresa')
  })
})

describe('perguntas editáveis', () => {
  const PROPRIAS = [
    { chave: 'nome', etapa: 'Básico', rotulo: 'Nome', tipo: 'texto', obrigatoria: true },
    { chave: 'pet', etapa: 'Extra', rotulo: 'Tem pet?', tipo: 'escolha_unica', opcoes: ['Sim', 'Não', 'Sim'], obrigatoria: false },
  ]

  it('normaliza e descarta o que está malformado', () => {
    const lista = normalizarPerguntas([
      ...PROPRIAS,
      { chave: 'nome', etapa: 'X', rotulo: 'Repetida', tipo: 'texto' },        // chave repetida
      { chave: 'sem_opcoes', etapa: 'X', rotulo: 'Escolha', tipo: 'multipla_escolha', opcoes: [] },
      { chave: 'tipo_ruim', etapa: 'X', rotulo: 'Ruim', tipo: 'arquivo' },
      'lixo', null,
    ])!
    expect(lista.map((q) => q.chave)).toEqual(['nome', 'pet'])
    expect(lista[1].opcoes).toEqual(['Sim', 'Não'])
    expect(normalizarPerguntas([])).toBeNull()
    expect(normalizarPerguntas(null)).toBeNull()
  })

  it('briefing usa as próprias perguntas, ou o padrão se não tiver', () => {
    expect(perguntasDoBriefing({ modelo: 'site', perguntas: PROPRIAS }).length).toBe(2)
    expect(perguntasDoBriefing({ modelo: 'site', perguntas: null })).toBe(MODELOS_BRIEFING.site.perguntas)
  })

  it('valida e limpa respostas pelas perguntas do briefing', () => {
    const lista = normalizarPerguntas(PROPRIAS)!
    expect(errosDoBriefing(lista, {})).toEqual({ nome: 'Preencha este campo.' })
    expect(limparRespostas(lista, { nome: 'Ana', pet: 'Talvez', nome_empresa: 'x' })).toEqual({ nome: 'Ana' })
    expect(textoRespostas('Ana', { modelo: 'site', perguntas: lista, respostas: { nome: 'Ana' }, respondido_em: null })).toContain('## 2. Extra')
  })

  it('aponta problema antes de salvar', () => {
    expect(problemaNasPerguntas([])).toBe('Deixe pelo menos uma pergunta.')
    expect(problemaNasPerguntas([{ chave: 'a', etapa: 'E', rotulo: ' ', tipo: 'texto', obrigatoria: false }])).toContain('escreva o texto')
    expect(problemaNasPerguntas([{ chave: 'a', etapa: 'E', rotulo: 'Cor?', tipo: 'escolha_unica', opcoes: [' '], obrigatoria: false }])).toContain('opções')
    expect(problemaNasPerguntas(normalizarPerguntas(PROPRIAS)!)).toBeNull()
  })

  it('gera chave única sem acento', () => {
    expect(gerarChave('Qual é o horário?', [])).toBe('qual_e_o_horario')
    expect(gerarChave('Qual é o horário?', ['qual_e_o_horario'])).toBe('qual_e_o_horario_2')
    expect(gerarChave('???', [])).toBe('pergunta')
  })
})

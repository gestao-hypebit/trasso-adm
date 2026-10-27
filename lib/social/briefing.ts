import type { BadgeProps } from '@/components/ui/badge'

type Variante = NonNullable<BadgeProps['variant']>

// ─── Modelos de briefing ───
// As perguntas ficam aqui (não no banco). Mudar uma pergunta não mexe nas
// respostas já salvas: elas são guardadas por `chave`.

export type TipoPergunta = 'texto' | 'texto_longo' | 'telefone' | 'email' | 'escolha_unica' | 'multipla_escolha'

export type Pergunta = {
  chave: string
  etapa: string
  rotulo: string
  tipo: TipoPergunta
  opcoes?: string[]
  obrigatoria: boolean
  ajuda?: string
  placeholder?: string
}

export type Resposta = string | string[]
export type Respostas = Record<string, Resposta>

type Extra = Partial<Pick<Pergunta, 'opcoes' | 'ajuda' | 'placeholder'>> & { obrigatoria?: boolean }
const p = (etapa: string, chave: string, rotulo: string, tipo: TipoPergunta, extra: Extra = {}): Pergunta =>
  ({ etapa, chave, rotulo, tipo, obrigatoria: false, ...extra })

const OBRIG = { obrigatoria: true }
const PUBLICO_TIPO = ['Consumidor final', 'Comércios e revendedores', 'Os dois']
const ENTREGA = ['Retirada na loja', 'Entrega na cidade', 'Envio para outras cidades']

const PERFIL_EXISTENTE: Pergunta[] = [
  p('Sobre a loja', 'nome_loja', 'Nome da loja', 'texto', OBRIG),
  p('Sobre a loja', 'responsavel', 'Seu nome', 'texto', OBRIG),
  p('Sobre a loja', 'whatsapp', 'WhatsApp de pedidos', 'telefone', { ...OBRIG, placeholder: '(00) 00000-0000' }),
  p('Sobre a loja', 'instagram_atual', '@ do Instagram da loja', 'texto', { ...OBRIG, placeholder: '@sualoja' }),
  p('Sobre a loja', 'cidade', 'Cidade e bairro', 'texto'),
  p('Sobre a loja', 'onde_vende', 'Onde você vende?', 'multipla_escolha', { opcoes: ['Loja física', 'Só pelo WhatsApp/Instagram', 'Site', 'Catálogo digital'] }),
  p('Sobre a loja', 'entrega', 'Como o cliente recebe?', 'multipla_escolha', { opcoes: ENTREGA }),
  p('Sobre a loja', 'historia', 'Conte um pouco da história da loja', 'texto_longo', { ajuda: 'Como começou, o que te motivou, o que te deixa orgulhosa(o)' }),

  p('Produtos', 'produtos', 'O que você vende?', 'texto_longo', OBRIG),
  p('Produtos', 'mais_vendidos', 'Quais produtos mais vendem?', 'texto_longo'),
  p('Produtos', 'faixa_preco', 'Faixa de preço dos produtos', 'texto', { placeholder: 'Ex.: de R$ 150 a R$ 400' }),
  p('Produtos', 'diferencial', 'Por que o cliente compra de você e não do concorrente?', 'texto_longo'),
  p('Produtos', 'fotos', 'Você tem fotos próprias dos produtos?', 'escolha_unica', { opcoes: ['Sim, de quase tudo', 'Algumas', 'Uso fotos de fornecedor', 'Não tenho'] }),

  p('Público', 'publico_quem', 'Quem mais compra de você?', 'texto_longo', { ajuda: 'Homens, mulheres, faixa de idade, estilo de vida' }),
  p('Público', 'publico_tipo', 'Você vende mais para', 'escolha_unica', { opcoes: PUBLICO_TIPO }),

  p('O Instagram hoje', 'frequencia_atual', 'Com que frequência você posta hoje?', 'escolha_unica', { opcoes: ['Quase todo dia', 'Algumas vezes por semana', 'De vez em quando', 'Está parado'] }),
  p('O Instagram hoje', 'quem_posta', 'Quem cuida do Instagram hoje?', 'texto'),
  p('O Instagram hoje', 'funciona', 'O que você sente que funciona bem no seu perfil?', 'texto_longo'),
  p('O Instagram hoje', 'nao_funciona', 'E o que não funciona ou te incomoda?', 'texto_longo'),
  p('O Instagram hoje', 'identidade_visual', 'Sua marca tem identidade visual definida?', 'escolha_unica', { opcoes: ['Sim, cores e fontes definidas', 'Tenho logo e cores mais ou menos', 'Não tenho'] }),
  p('O Instagram hoje', 'manter_visual', 'Quer manter o visual atual?', 'escolha_unica', { opcoes: ['Quero manter', 'Aberta(o) a ajustes', 'Quero mudar tudo'] }),

  p('Objetivos', 'objetivo', 'O que você mais quer agora?', 'multipla_escolha', { ...OBRIG, opcoes: ['Vender mais', 'Ganhar seguidores', 'Deixar o perfil mais profissional', 'Divulgar a loja física'] }),
  p('Objetivos', 'datas', 'Tem alguma data, promoção ou lançamento chegando?', 'texto_longo', { ajuda: 'Ex.: Black Friday, Natal, coleção nova' }),
  p('Objetivos', 'tom_voz', 'Como a loja conversa com o cliente?', 'escolha_unica', { opcoes: ['Descontraído e próximo', 'Tradicional e familiar', 'Direto e profissional', 'Inspirador e motivacional'] }),
  p('Objetivos', 'referencias', 'Perfis que você admira (de qualquer ramo)', 'texto'),
  p('Objetivos', 'evitar', 'Algo que você NÃO quer no seu perfil?', 'texto'),
  p('Objetivos', 'observacoes', 'Mais alguma coisa?', 'texto_longo'),
]

const PERFIL_NOVO: Pergunta[] = [
  p('Sobre a loja', 'nome_loja', 'Nome da loja', 'texto', OBRIG),
  p('Sobre a loja', 'responsavel', 'Seu nome', 'texto', OBRIG),
  p('Sobre a loja', 'whatsapp', 'WhatsApp de pedidos', 'telefone', { ...OBRIG, placeholder: '(00) 00000-0000' }),
  p('Sobre a loja', 'cidade', 'Cidade e bairro', 'texto'),
  p('Sobre a loja', 'horario', 'Horário de atendimento', 'texto'),
  p('Sobre a loja', 'historia', 'Conte um pouco da história da loja', 'texto_longo'),

  p('O perfil', 'sugestoes_arroba', 'Sugestões de @ para o perfil', 'texto', { ...OBRIG, ajuda: 'Mande 2 ou 3 opções. A gente confere quais estão livres. O Instagram não aceita acentos.' }),
  p('O perfil', 'email_cadastro', 'E-mail da loja para cadastrar o Instagram', 'email', { ajuda: 'A senha a gente combina com você na hora, nunca por aqui.' }),
  p('O perfil', 'logo', 'Você já tem logo?', 'escolha_unica', { opcoes: ['Sim, já tenho', 'Tenho, mas quero melhorar', 'Não tenho'] }),
  p('O perfil', 'cores', 'Cores da marca', 'texto'),
  p('O perfil', 'facebook', 'Você tem perfil pessoal no Facebook?', 'escolha_unica', { opcoes: ['Sim', 'Não'] }),

  p('Como você vende', 'publico_tipo', 'Você vende mais para', 'escolha_unica', { opcoes: PUBLICO_TIPO }),
  p('Como você vende', 'entrega', 'Como o cliente recebe?', 'multipla_escolha', { opcoes: ENTREGA }),
  p('Como você vende', 'pagamento', 'Formas de pagamento', 'multipla_escolha', { opcoes: ['Pix', 'Cartão', 'Dinheiro', 'Boleto / a prazo'] }),
  p('Como você vende', 'pedido_minimo', 'Tem pedido mínimo ou preço especial no atacado?', 'texto'),

  p('Produtos', 'produtos', 'Principais produtos', 'texto_longo', OBRIG),
  p('Produtos', 'carro_chefe', 'Qual é o carro-chefe?', 'texto'),
  p('Produtos', 'diferencial', 'Por que o cliente compra de você e não do concorrente?', 'texto_longo'),
  p('Produtos', 'fotos', 'Você tem fotos dos produtos?', 'escolha_unica', { opcoes: ['Sim, de quase tudo', 'Algumas', 'Não tenho'] }),

  p('Estilo do perfil', 'tom_voz', 'Tom de voz', 'escolha_unica', { opcoes: ['Descontraído e próximo', 'Tradicional e familiar', 'Direto e profissional'] }),
  p('Estilo do perfil', 'referencias', 'Perfis que você gosta (de qualquer ramo)', 'texto'),
  p('Estilo do perfil', 'evitar', 'Algo que você NÃO quer no perfil?', 'texto'),
  p('Estilo do perfil', 'observacoes', 'Mais alguma coisa?', 'texto_longo'),
]

export const MODELOS_BRIEFING = {
  perfil_novo:      { label: 'Perfil novo',      descricao: 'A Slick vai criar o Instagram do zero.', perguntas: PERFIL_NOVO },
  perfil_existente: { label: 'Perfil existente', descricao: 'O cliente já tem Instagram ativo.',      perguntas: PERFIL_EXISTENTE },
} as const
export type ModeloBriefing = keyof typeof MODELOS_BRIEFING

export const isModelo = (v: unknown): v is ModeloBriefing => typeof v === 'string' && v in MODELOS_BRIEFING

// Perguntas agrupadas por etapa, na ordem em que aparecem.
export function etapasDoModelo(modelo: ModeloBriefing) {
  const etapas: { titulo: string; perguntas: Pergunta[] }[] = []
  for (const q of MODELOS_BRIEFING[modelo].perguntas) {
    const ultima = etapas[etapas.length - 1]
    if (ultima?.titulo === q.etapa) ultima.perguntas.push(q)
    else etapas.push({ titulo: q.etapa, perguntas: [q] })
  }
  return etapas
}

// ─── Status ───

export type StatusBriefing = 'enviado' | 'respondido'

export const STATUS_BRIEFING: Record<StatusBriefing | 'sem', { label: string; variant: Variante }> = {
  sem:        { label: 'Sem briefing',      variant: 'outline' },
  enviado:    { label: 'Briefing pendente', variant: 'pendente' },
  respondido: { label: 'Briefing respondido', variant: 'aprovada' },
}

export type Briefing = {
  id: string
  cliente_id: string
  modelo: ModeloBriefing
  token: string
  status: StatusBriefing
  respostas: Respostas
  created_at: string
  respondido_em: string | null
}

export const ERRO_MIGRATION_BRIEFING = 'Rode a migration 20261027000000_social_briefings.sql no Supabase antes de usar.'

// ─── Validação (usada no formulário e de novo no servidor) ───

const MAX_TEXTO = 300
const MAX_TEXTO_LONGO = 5000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const vazia = (v: Resposta | undefined) => (Array.isArray(v) ? v.length === 0 : !v?.trim())

// Mensagem de erro da pergunta, ou null se estiver ok.
export function erroDaPergunta(q: Pergunta, v: Resposta | undefined): string | null {
  if (vazia(v)) return q.obrigatoria ? (q.opcoes ? 'Escolha pelo menos uma opção.' : 'Preencha este campo.') : null
  const texto = Array.isArray(v) ? '' : v!.trim()
  if (q.tipo === 'telefone' && texto.replace(/\D/g, '').length < 10) return 'Informe o número com DDD.'
  if (q.tipo === 'email' && !EMAIL_RE.test(texto)) return 'Confira o e-mail.'
  return null
}

export function errosDoBriefing(modelo: ModeloBriefing, respostas: Respostas) {
  const erros: Record<string, string> = {}
  for (const q of MODELOS_BRIEFING[modelo].perguntas) {
    const e = erroDaPergunta(q, respostas[q.chave])
    if (e) erros[q.chave] = e
  }
  return erros
}

// Mantém só as chaves do modelo, com o tipo certo e tamanho limitado.
// Escolhas fora da lista de opções são descartadas.
export function limparRespostas(modelo: ModeloBriefing, bruto: unknown): Respostas {
  const entrada = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const saida: Respostas = {}
  for (const q of MODELOS_BRIEFING[modelo].perguntas) {
    const v = entrada[q.chave]
    if (q.tipo === 'multipla_escolha') {
      const lista = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && q.opcoes!.includes(x)) : []
      if (lista.length) saida[q.chave] = [...new Set(lista)]
    } else if (q.tipo === 'escolha_unica') {
      if (typeof v === 'string' && q.opcoes!.includes(v)) saida[q.chave] = v
    } else if (typeof v === 'string' && v.trim()) {
      saida[q.chave] = v.trim().slice(0, q.tipo === 'texto_longo' ? MAX_TEXTO_LONGO : MAX_TEXTO)
    }
  }
  return saida
}

// ─── Textos para copiar ───

export const linkBriefing = (token: string) =>
  typeof window !== 'undefined' ? `${window.location.origin}/briefing/${token}` : `/briefing/${token}`

export const mensagemWhatsappBriefing = (nome: string, link: string) =>
  `Oi, ${nome}! Tudo bem? 😊\nPara eu montar o planejamento do seu Instagram, preciso conhecer melhor a sua loja.\nResponde esse formulário rapidinho (leva uns 5 minutos):\n${link}`

export const formatarResposta = (v: Resposta | undefined) => (Array.isArray(v) ? v.join(', ') : v?.trim()) || '—'

// Briefing inteiro em texto, organizado por etapa (para colar no Claude ou em outro lugar).
export function textoRespostas(cliente: string, b: Pick<Briefing, 'modelo' | 'respostas' | 'respondido_em'>) {
  const data = b.respondido_em ? new Date(b.respondido_em).toLocaleDateString('pt-BR') : null
  const linhas = [`Briefing · ${cliente} · ${MODELOS_BRIEFING[b.modelo].label}${data ? ` · respondido em ${data}` : ''}`]
  etapasDoModelo(b.modelo).forEach((etapa, i) => {
    linhas.push('', `## ${i + 1}. ${etapa.titulo}`)
    for (const q of etapa.perguntas) linhas.push(`- ${q.rotulo}: ${formatarResposta(b.respostas[q.chave])}`)
  })
  return linhas.join('\n')
}

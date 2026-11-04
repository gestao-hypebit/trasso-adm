import type { BadgeProps } from '@/components/ui/badge'

type Variante = NonNullable<BadgeProps['variant']>

// ─── Modelos de briefing ───
// As perguntas padrão ficam aqui. Ao gerar um briefing, as perguntas são
// copiadas para ele (coluna `perguntas`) e podem ser ajustadas para aquele
// cliente pelo painel. O padrão também pode ser trocado pelo painel
// (tabela briefing_modelos); sem nada lá, vale o que está aqui.
// As respostas são guardadas por `chave`.

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

// Social media de quem não é loja: serviços, consultorias, profissionais liberais.
// Vale para perfil novo ou existente, e as perguntas específicas de cada cliente
// entram pelo "Editar perguntas".
const EMPRESA: Pergunta[] = [
  p('Sobre a empresa', 'nome_empresa', 'Nome da empresa', 'texto', OBRIG),
  p('Sobre a empresa', 'responsavel', 'Seu nome', 'texto', OBRIG),
  p('Sobre a empresa', 'whatsapp', 'WhatsApp de contato', 'telefone', { ...OBRIG, placeholder: '(00) 00000-0000' }),
  p('Sobre a empresa', 'segmento', 'Ramo de atuação', 'texto', { placeholder: 'Ex.: consultoria, advocacia, clínica, engenharia' }),
  p('Sobre a empresa', 'cidade', 'Cidade ou região onde atende', 'texto'),
  p('Sobre a empresa', 'formato_atendimento', 'Como você atende?', 'multipla_escolha', { opcoes: ['Presencial', 'Online', 'Na casa ou empresa do cliente'] }),
  p('Sobre a empresa', 'historia', 'Conte um pouco da história da empresa', 'texto_longo', { ajuda: 'Como começou, há quanto tempo existe, quem está à frente.' }),

  p('O que você oferece', 'servicos', 'Quais serviços ou soluções a empresa oferece?', 'texto_longo', { ...OBRIG, ajuda: 'Explique como se fosse para alguém que nunca ouviu falar de vocês.' }),
  p('O que você oferece', 'principal', 'Qual deles você mais quer divulgar?', 'texto'),
  p('O que você oferece', 'como_cobra', 'Como você cobra pelo seu trabalho?', 'texto', { placeholder: 'Ex.: mensalidade, por projeto, por hora, porcentagem' }),
  p('O que você oferece', 'como_funciona', 'Como funciona, do primeiro contato até o fechamento?', 'texto_longo'),
  p('O que você oferece', 'diferencial', 'Por que o cliente escolhe vocês e não o concorrente?', 'texto_longo'),
  p('O que você oferece', 'concorrentes', 'Principais concorrentes', 'texto'),

  p('Seu cliente', 'publico_tipo', 'Você atende mais', 'escolha_unica', { opcoes: ['Pessoas físicas', 'Empresas', 'Os dois'] }),
  p('Seu cliente', 'publico_quem', 'Quem é o seu cliente ideal?', 'texto_longo', { ajuda: 'Idade, profissão, momento de vida ou porte da empresa.' }),
  p('Seu cliente', 'publico_problemas', 'Que problema ou desejo faz essa pessoa te procurar?', 'texto_longo'),
  p('Seu cliente', 'publico_duvidas', 'Quais dúvidas e objeções você mais ouve antes de fechar?', 'texto_longo'),

  p('Credibilidade e regras', 'credenciais', 'Registros, certificações ou prêmios que a empresa tem', 'texto_longo', { ajuda: 'Tudo que ajuda a mostrar que vocês são confiáveis.' }),
  p('Credibilidade e regras', 'provas', 'Tem cases, números ou depoimentos que podem ser divulgados?', 'texto_longo'),
  p('Credibilidade e regras', 'regras_setor', 'Existe alguma regra sobre o que a empresa pode publicar?', 'texto_longo', { ajuda: 'Órgão regulador, conselho de classe ou compliance: o que não pode ser dito ou prometido, avisos obrigatórios.' }),
  p('Credibilidade e regras', 'aprovacao', 'Quem aprova os conteúdos antes de publicar?', 'texto'),

  p('O Instagram', 'situacao_instagram', 'Como está o Instagram hoje?', 'escolha_unica', { opcoes: ['Ativo', 'Tenho, mas está parado', 'Ainda não tenho'] }),
  p('O Instagram', 'instagram_atual', '@ do Instagram, se já tiver', 'texto', { placeholder: '@suaempresa' }),
  p('O Instagram', 'sugestoes_arroba', 'Se ainda não tem, sugestões de @', 'texto', { ajuda: 'Mande 2 ou 3 opções. A gente confere quais estão livres.' }),
  p('O Instagram', 'funciona', 'O que você sente que funciona bem no perfil?', 'texto_longo'),
  p('O Instagram', 'nao_funciona', 'E o que não funciona ou te incomoda?', 'texto_longo'),
  p('O Instagram', 'identidade_visual', 'A marca tem identidade visual definida?', 'escolha_unica', { opcoes: ['Sim, logo, cores e fontes definidas', 'Tenho logo e cores mais ou menos', 'Não tenho'] }),
  p('O Instagram', 'quem_aparece', 'Quem pode aparecer em fotos e vídeos?', 'multipla_escolha', { opcoes: ['Sócios ou liderança', 'Equipe', 'Clientes, com autorização', 'Prefiro não mostrar pessoas'] }),
  p('O Instagram', 'materiais', 'Link da pasta com logo, fotos e materiais', 'texto', { ajuda: 'Google Drive, Dropbox ou WeTransfer. Pode mandar depois também.' }),

  p('Objetivos e estilo', 'objetivo', 'O que você mais quer agora?', 'multipla_escolha', { ...OBRIG, opcoes: ['Atrair novos clientes', 'Gerar contatos e reuniões', 'Passar mais credibilidade', 'Educar o público sobre o assunto', 'Fortalecer a marca', 'Ganhar seguidores'] }),
  p('Objetivos e estilo', 'temas', 'Sobre quais assuntos você gostaria de falar?', 'texto_longo'),
  p('Objetivos e estilo', 'datas', 'Tem alguma data, evento ou lançamento chegando?', 'texto_longo'),
  p('Objetivos e estilo', 'tom_voz', 'Como a empresa conversa com o cliente?', 'escolha_unica', { opcoes: ['Próximo e acolhedor', 'Direto e profissional', 'Técnico e didático', 'Sofisticado', 'Descontraído'] }),
  p('Objetivos e estilo', 'referencias', 'Perfis que você admira (de qualquer ramo)', 'texto'),
  p('Objetivos e estilo', 'evitar', 'Algo que você NÃO quer no seu perfil?', 'texto'),
  p('Objetivos e estilo', 'observacoes', 'Mais alguma coisa?', 'texto_longo'),
]

// Desenvolvimento de site. As opções de estilo e tom são as mesmas do
// gerador de prévias (lib/sites/tipos.ts), para dar para levar as respostas para lá.
const SITE: Pergunta[] = [
  p('Sobre a empresa', 'nome_empresa', 'Nome da empresa', 'texto', OBRIG),
  p('Sobre a empresa', 'responsavel', 'Seu nome', 'texto', OBRIG),
  p('Sobre a empresa', 'whatsapp', 'Seu WhatsApp', 'telefone', { ...OBRIG, placeholder: '(00) 00000-0000' }),
  p('Sobre a empresa', 'email', 'E-mail de contato', 'email'),
  p('Sobre a empresa', 'segmento', 'Ramo de atuação', 'texto', { placeholder: 'Ex.: clínica odontológica, loja de móveis, advocacia' }),
  p('Sobre a empresa', 'cidade', 'Cidade onde atende', 'texto'),
  p('Sobre a empresa', 'descricao', 'O que a empresa faz e para quem?', 'texto_longo', { ...OBRIG, ajuda: 'Explique como se fosse para alguém que nunca ouviu falar de vocês.' }),
  p('Sobre a empresa', 'historia', 'Um pouco da história', 'texto_longo', { ajuda: 'Como começou, há quanto tempo existe, o que deixa vocês orgulhosos.' }),

  p('O site', 'objetivo', 'O que o site precisa fazer por você?', 'multipla_escolha', { ...OBRIG, opcoes: ['Trazer contatos pelo WhatsApp', 'Passar mais credibilidade', 'Aparecer no Google', 'Mostrar portfólio / trabalhos', 'Vender online', 'Receber agendamentos'] }),
  p('O site', 'acao_principal', 'Qual a principal ação que o visitante deve fazer?', 'escolha_unica', { opcoes: ['Chamar no WhatsApp', 'Preencher um formulário', 'Ligar', 'Comprar', 'Agendar um horário'] }),
  p('O site', 'paginas', 'O que o site precisa ter?', 'multipla_escolha', { opcoes: ['Sobre a empresa', 'Serviços / produtos', 'Portfólio / galeria', 'Depoimentos', 'Perguntas frequentes', 'Blog', 'Contato e mapa'] }),
  p('O site', 'site_atual', 'Já tem site? Qual o endereço?', 'texto', { placeholder: 'www.suaempresa.com.br' }),
  p('O site', 'site_atual_problema', 'Se já tem, o que não gosta nele?', 'texto_longo'),

  p('Conteúdo', 'servicos', 'Quais serviços ou produtos vão aparecer no site?', 'texto_longo', { ...OBRIG, ajuda: 'Um por linha. Se quiser, coloque uma frase explicando cada um.' }),
  p('Conteúdo', 'publico', 'Quem é o seu cliente ideal?', 'texto_longo', { ajuda: 'Idade, profissão, o que procura, o que o preocupa na hora de contratar.' }),
  p('Conteúdo', 'diferencial', 'Por que o cliente escolhe vocês e não o concorrente?', 'texto_longo'),
  p('Conteúdo', 'concorrentes', 'Principais concorrentes', 'texto'),
  p('Conteúdo', 'textos', 'Quem vai escrever os textos do site?', 'escolha_unica', { opcoes: ['Eu envio os textos', 'Quero que a Slick escreva', 'Um pouco de cada'] }),
  p('Conteúdo', 'fotos', 'Você tem fotos para o site?', 'escolha_unica', { opcoes: ['Sim, fotos profissionais', 'Algumas fotos de celular', 'Não tenho'] }),
  p('Conteúdo', 'depoimentos', 'Tem depoimentos ou avaliações de clientes?', 'escolha_unica', { opcoes: ['Sim, vários', 'Alguns', 'Não tenho'] }),
  p('Conteúdo', 'materiais', 'Link da pasta com logo, fotos e textos', 'texto', { ajuda: 'Google Drive, Dropbox ou WeTransfer. Pode mandar depois também.' }),

  p('Visual', 'logo', 'Você já tem logo?', 'escolha_unica', { opcoes: ['Sim, em boa qualidade', 'Tenho, mas só em imagem pequena', 'Não tenho'] }),
  p('Visual', 'cores', 'Cores da marca', 'texto', { ajuda: 'Se tiver alguma cor que você não quer de jeito nenhum, conta aqui também.' }),
  p('Visual', 'estilo', 'Qual estilo combina mais com a empresa?', 'escolha_unica', { opcoes: ['Moderno e minimalista', 'Elegante e premium', 'Vibrante e colorido', 'Corporativo e sóbrio', 'Aconchegante e artesanal'] }),
  p('Visual', 'tom_voz', 'Como a empresa conversa com o cliente?', 'escolha_unica', { opcoes: ['Profissional', 'Próximo e acolhedor', 'Sofisticado', 'Jovem e descontraído', 'Técnico e direto'] }),
  p('Visual', 'referencias', 'Sites que você gosta (de qualquer ramo)', 'texto_longo', { ajuda: 'Cole os links e diga o que gosta em cada um.' }),
  p('Visual', 'evitar', 'Algo que você NÃO quer no site?', 'texto'),

  p('Contato e lançamento', 'dominio', 'Já tem domínio (o endereço .com.br)?', 'escolha_unica', { opcoes: ['Sim, já tenho', 'Não, preciso registrar', 'Não sei'] }),
  p('Contato e lançamento', 'dominio_nome', 'Qual domínio tem ou gostaria de ter?', 'texto', { placeholder: 'suaempresa.com.br' }),
  p('Contato e lançamento', 'endereco', 'Endereço que vai no site', 'texto', { ajuda: 'Deixe em branco se não atende no local.' }),
  p('Contato e lançamento', 'horario', 'Horário de atendimento', 'texto'),
  p('Contato e lançamento', 'redes', 'Instagram e outras redes', 'texto', { placeholder: '@suaempresa' }),
  p('Contato e lançamento', 'prazo', 'Tem alguma data importante para o lançamento?', 'texto'),
  p('Contato e lançamento', 'observacoes', 'Mais alguma coisa?', 'texto_longo'),
]

export type AreaBriefing = 'social' | 'site'

const TEXTOS_SOCIAL = {
  area: 'social' as AreaBriefing,
  topo: 'Briefing de social media',
  titulo: 'Vamos conhecer a sua loja',
  intro: 'Leva uns 5 minutos.',
  obrigado: 'Em breve te enviamos o planejamento.',
}

export const MODELOS_BRIEFING = {
  perfil_novo:      { label: 'Perfil novo',      descricao: 'A Slick vai criar o Instagram do zero.', perguntas: PERFIL_NOVO, ...TEXTOS_SOCIAL },
  perfil_existente: { label: 'Perfil existente', descricao: 'O cliente já tem Instagram ativo.',      perguntas: PERFIL_EXISTENTE, ...TEXTOS_SOCIAL },
  empresa: {
    label: 'Empresa / serviços', descricao: 'Para quem não é loja: serviços, consultorias, profissionais liberais.', perguntas: EMPRESA,
    ...TEXTOS_SOCIAL,
    titulo: 'Vamos conhecer a sua empresa',
    intro: 'Leva uns 10 minutos. Quanto mais detalhe, mais o conteúdo fica com a cara da sua empresa.',
  },
  site: {
    label: 'Site', descricao: 'Desenvolvimento de site ou landing page.', perguntas: SITE,
    area: 'site' as AreaBriefing,
    topo: 'Briefing do seu site',
    titulo: 'Vamos montar o seu site',
    intro: 'Leva uns 10 minutos. Quanto mais detalhe, mais o site fica com a cara da sua empresa.',
    obrigado: 'Agora a gente começa a desenhar o seu site. Qualquer dúvida, chamamos no WhatsApp.',
  },
}
export type ModeloBriefing = keyof typeof MODELOS_BRIEFING

export const modelosDaArea = (area: AreaBriefing) =>
  (Object.keys(MODELOS_BRIEFING) as ModeloBriefing[]).filter((k) => MODELOS_BRIEFING[k].area === area)

export const isModelo = (v: unknown): v is ModeloBriefing => typeof v === 'string' && v in MODELOS_BRIEFING

// As funções abaixo aceitam o modelo (perguntas padrão do código) ou a lista
// de perguntas do próprio briefing.
type Fonte = ModeloBriefing | Pergunta[]
const listaDe = (f: Fonte): Pergunta[] => (typeof f === 'string' ? MODELOS_BRIEFING[f].perguntas : f)

// Perguntas agrupadas por etapa, na ordem em que aparecem.
export function etapasDoModelo(fonte: Fonte) {
  const etapas: { titulo: string; perguntas: Pergunta[] }[] = []
  for (const q of listaDe(fonte)) {
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
  projeto_id?: string | null
  token: string
  status: StatusBriefing
  respostas: Respostas
  perguntas?: unknown            // perguntas deste briefing; null nos antigos (usa o padrão do código)
  created_at: string
  respondido_em: string | null
}

export const ERRO_MIGRATION_BRIEFING = 'Rode a migration 20261027000000_social_briefings.sql no Supabase antes de usar.'
export const ERRO_MIGRATION_BRIEFING_SITE = 'Rode a migration 20261108000000_briefing_site.sql no Supabase antes de usar.'
export const ERRO_MIGRATION_BRIEFING_EMPRESA = 'Rode a migration 20261115000000_briefing_empresa.sql no Supabase antes de usar este modelo.'
export const ERRO_MIGRATION_PERGUNTAS = 'Rode a migration 20261109000000_briefing_perguntas.sql no Supabase para editar perguntas.'

// ─── Perguntas editáveis ───

const TIPOS: TipoPergunta[] = ['texto', 'texto_longo', 'telefone', 'email', 'escolha_unica', 'multipla_escolha']
export const TIPOS_PERGUNTA: Record<TipoPergunta, string> = {
  texto: 'Texto curto',
  texto_longo: 'Texto longo',
  telefone: 'Telefone',
  email: 'E-mail',
  escolha_unica: 'Escolha uma opção',
  multipla_escolha: 'Escolha várias opções',
}
export const temOpcoes = (t: TipoPergunta) => t === 'escolha_unica' || t === 'multipla_escolha'

const MAX_PERGUNTAS = 80
const corta = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Lê perguntas vindas do banco ou do editor. Descarta o que estiver malformado.
// Devolve null se não sobrar nenhuma (aí vale o padrão).
export function normalizarPerguntas(bruto: unknown): Pergunta[] | null {
  if (!Array.isArray(bruto)) return null
  const vistas = new Set<string>()
  const saida: Pergunta[] = []
  for (const item of bruto.slice(0, MAX_PERGUNTAS)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const chave = corta(o.chave, 60)
    const rotulo = corta(o.rotulo, 300)
    const tipo = o.tipo as TipoPergunta
    if (!chave || !rotulo || !TIPOS.includes(tipo) || vistas.has(chave)) continue
    const q: Pergunta = { chave, etapa: corta(o.etapa, 80) || 'Perguntas', rotulo, tipo, obrigatoria: o.obrigatoria === true }
    if (temOpcoes(tipo)) {
      const opcoes = [...new Set((Array.isArray(o.opcoes) ? o.opcoes : []).map((x) => corta(x, 120)).filter(Boolean))].slice(0, 30)
      if (!opcoes.length) continue
      q.opcoes = opcoes
    }
    const ajuda = corta(o.ajuda, 300)
    const placeholder = corta(o.placeholder, 120)
    if (ajuda) q.ajuda = ajuda
    if (placeholder && !temOpcoes(tipo)) q.placeholder = placeholder
    vistas.add(chave)
    saida.push(q)
  }
  return saida.length ? saida : null
}

// Perguntas que valem para este briefing: as dele, ou o padrão do modelo.
export const perguntasDoBriefing = (b: { modelo: ModeloBriefing; perguntas?: unknown }) =>
  normalizarPerguntas(b.perguntas) ?? MODELOS_BRIEFING[b.modelo].perguntas

// O que impede salvar o que está no editor, ou null se estiver tudo certo.
export function problemaNasPerguntas(lista: Pergunta[]): string | null {
  if (!lista.length) return 'Deixe pelo menos uma pergunta.'
  if (lista.length > MAX_PERGUNTAS) return `No máximo ${MAX_PERGUNTAS} perguntas.`
  for (const [i, q] of lista.entries()) {
    const n = `Pergunta ${i + 1}`
    if (!q.rotulo.trim()) return `${n}: escreva o texto da pergunta.`
    if (!q.etapa.trim()) return `${n}: informe a etapa.`
    if (temOpcoes(q.tipo) && !(q.opcoes ?? []).some((o) => o.trim())) return `${n} ("${q.rotulo.trim()}"): coloque as opções, uma por linha.`
  }
  return null
}

// Chave para uma pergunta nova, a partir do texto. Única dentro da lista.
export function gerarChave(rotulo: string, existentes: Iterable<string>) {
  const usadas = new Set(existentes)
  const base = rotulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'pergunta'
  let chave = base
  for (let i = 2; usadas.has(chave); i++) chave = `${base}_${i}`
  return chave
}

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

export function errosDoBriefing(fonte: Fonte, respostas: Respostas) {
  const erros: Record<string, string> = {}
  for (const q of listaDe(fonte)) {
    const e = erroDaPergunta(q, respostas[q.chave])
    if (e) erros[q.chave] = e
  }
  return erros
}

// Mantém só as chaves do modelo, com o tipo certo e tamanho limitado.
// Escolhas fora da lista de opções são descartadas.
export function limparRespostas(fonte: Fonte, bruto: unknown): Respostas {
  const entrada = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const saida: Respostas = {}
  for (const q of listaDe(fonte)) {
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

export const mensagemWhatsappBriefing = (nome: string, link: string, modelo: ModeloBriefing = 'perfil_novo') =>
  MODELOS_BRIEFING[modelo].area === 'site'
    ? `Oi, ${nome}! Tudo bem? 😊\nPara começarmos o seu site, preciso conhecer melhor a sua empresa.\nResponde esse formulário (leva uns 10 minutos):\n${link}`
    : modelo === 'empresa'
      ? `Oi, ${nome}! Tudo bem? 😊\nPara eu montar o planejamento do seu Instagram, preciso conhecer melhor a sua empresa.\nResponde esse formulário (leva uns 10 minutos):\n${link}`
      : `Oi, ${nome}! Tudo bem? 😊\nPara eu montar o planejamento do seu Instagram, preciso conhecer melhor a sua loja.\nResponde esse formulário rapidinho (leva uns 5 minutos):\n${link}`

export const formatarResposta = (v: Resposta | undefined) => (Array.isArray(v) ? v.join(', ') : v?.trim()) || '—'

// Briefing inteiro em texto, organizado por etapa (para colar no Claude ou em outro lugar).
export function textoRespostas(cliente: string, b: Pick<Briefing, 'modelo' | 'respostas' | 'respondido_em' | 'perguntas'>) {
  const data = b.respondido_em ? new Date(b.respondido_em).toLocaleDateString('pt-BR') : null
  const linhas = [`Briefing · ${cliente} · ${MODELOS_BRIEFING[b.modelo].label}${data ? ` · respondido em ${data}` : ''}`]
  etapasDoModelo(perguntasDoBriefing(b)).forEach((etapa, i) => {
    linhas.push('', `## ${i + 1}. ${etapa.titulo}`)
    for (const q of etapa.perguntas) linhas.push(`- ${q.rotulo}: ${formatarResposta(b.respostas[q.chave])}`)
  })
  return linhas.join('\n')
}

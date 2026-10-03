// Modelos de onboarding (checklist + briefing) por tipo de projeto.
// Ao iniciar o onboarding, o modelo é copiado para o projeto e pode ser
// editado lá sem afetar os próximos.

export type PerguntaBriefing = {
  chave: string
  rotulo: string
  tipo: 'texto' | 'textarea' | 'link'
  ajuda?: string
  obrigatorio: boolean
}

export type ItemModelo = { titulo: string; descricao?: string; responsavel: 'cliente' | 'agencia' }

export type OnboardingItem = {
  id: string
  projeto_id: string
  titulo: string
  descricao: string | null
  responsavel: 'cliente' | 'agencia'
  concluido: boolean
  concluido_em: string | null
  concluido_por: 'cliente' | 'agencia' | null
  ordem: number
}

export type Briefing = {
  id: string
  projeto_id: string
  perguntas: PerguntaBriefing[]
  respostas: Record<string, string>
  status: 'pendente' | 'respondido'
  respondido_em: string | null
}

const P = (chave: string, rotulo: string, tipo: PerguntaBriefing['tipo'] = 'textarea', obrigatorio = true, ajuda?: string): PerguntaBriefing =>
  ({ chave, rotulo, tipo, obrigatorio, ajuda })

const perguntasBase: PerguntaBriefing[] = [
  P('negocio', 'Conta sobre o seu negócio: o que vocês fazem e para quem?'),
  P('objetivo', 'Qual o principal objetivo deste projeto?', 'textarea', true, 'Ex.: receber mais pedidos pelo WhatsApp, passar mais credibilidade, organizar o atendimento…'),
  P('publico', 'Quem é o seu cliente ideal?'),
  P('referencias', 'Referências que você gosta (sites, marcas, perfis)', 'textarea', false, 'Cole os links e diga o que gosta em cada um.'),
  P('concorrentes', 'Principais concorrentes', 'textarea', false),
  P('prazo', 'Existe alguma data importante para o lançamento?', 'texto', false),
]

const modelos: Record<string, { itens: ItemModelo[]; perguntas: PerguntaBriefing[] }> = {
  site: {
    itens: [
      { titulo: 'Responder o briefing', responsavel: 'cliente' },
      { titulo: 'Enviar logo em boa qualidade', descricao: 'De preferência em PNG com fundo transparente, SVG ou PDF.', responsavel: 'cliente' },
      { titulo: 'Enviar textos e fotos do negócio', descricao: 'Pode ser um link do Google Drive com tudo junto.', responsavel: 'cliente' },
      { titulo: 'Informar acesso ao domínio', descricao: 'Onde o domínio está registrado (Registro.br, GoDaddy…) e o login, ou nos adicionar como técnicos.', responsavel: 'cliente' },
      { titulo: 'Informar WhatsApp, e-mail e redes que vão no site', responsavel: 'cliente' },
      { titulo: 'Reunião de kickoff', responsavel: 'agencia' },
      { titulo: 'Configurar hospedagem e domínio', responsavel: 'agencia' },
      { titulo: 'Criar grupo de acompanhamento com o cliente', responsavel: 'agencia' },
    ],
    perguntas: [
      ...perguntasBase,
      P('paginas', 'Quais páginas/seções o site precisa ter?', 'textarea', true, 'Ex.: início, sobre, serviços, depoimentos, contato.'),
      P('dominio', 'Já tem domínio? Qual?', 'texto', false),
      P('materiais', 'Link da pasta com logo, fotos e textos', 'link', false),
    ],
  },
  software: {
    itens: [
      { titulo: 'Responder o briefing', responsavel: 'cliente' },
      { titulo: 'Enviar exemplos de planilhas/processos usados hoje', responsavel: 'cliente' },
      { titulo: 'Indicar quem vai validar as entregas', responsavel: 'cliente' },
      { titulo: 'Liberar acessos a sistemas que precisam integrar', responsavel: 'cliente' },
      { titulo: 'Reunião de kickoff e levantamento de requisitos', responsavel: 'agencia' },
      { titulo: 'Documento de escopo aprovado', responsavel: 'agencia' },
      { titulo: 'Criar ambiente de testes', responsavel: 'agencia' },
    ],
    perguntas: [
      ...perguntasBase,
      P('processo_atual', 'Como esse processo funciona hoje, sem o sistema?'),
      P('usuarios', 'Quem vai usar o sistema e quantas pessoas?'),
      P('funcionalidades', 'Liste as funcionalidades indispensáveis para a primeira versão'),
      P('integracoes', 'Precisa integrar com algum sistema? (ERP, pagamento, WhatsApp…)', 'textarea', false),
    ],
  },
  identidade_visual: {
    itens: [
      { titulo: 'Responder o briefing', responsavel: 'cliente' },
      { titulo: 'Enviar logo atual (se existir)', responsavel: 'cliente' },
      { titulo: 'Reunião de kickoff', responsavel: 'agencia' },
      { titulo: 'Pesquisa de mercado e painel de referências', responsavel: 'agencia' },
    ],
    perguntas: [
      ...perguntasBase,
      P('personalidade', 'Se a sua marca fosse uma pessoa, como ela seria?'),
      P('cores', 'Cores que gosta ou que não quer de jeito nenhum', 'textarea', false),
      P('aplicacoes', 'Onde a marca vai aparecer? (fachada, embalagem, redes, uniforme…)'),
    ],
  },
  marketing: {
    itens: [
      { titulo: 'Responder o briefing', responsavel: 'cliente' },
      { titulo: 'Dar acesso ao Gerenciador de Negócios / Google Ads', responsavel: 'cliente' },
      { titulo: 'Definir verba mensal de anúncios', responsavel: 'cliente' },
      { titulo: 'Reunião de kickoff', responsavel: 'agencia' },
      { titulo: 'Configurar pixel e conversões', responsavel: 'agencia' },
    ],
    perguntas: [
      ...perguntasBase,
      P('verba', 'Verba mensal para anúncios', 'texto'),
      P('oferta', 'Qual produto/serviço quer vender mais?'),
      P('historico', 'Já anunciou antes? Como foi?', 'textarea', false),
    ],
  },
  social_media: {
    itens: [
      { titulo: 'Responder o briefing', responsavel: 'cliente' },
      { titulo: 'Dar acesso às redes sociais', responsavel: 'cliente' },
      { titulo: 'Enviar fotos e vídeos do negócio', responsavel: 'cliente' },
      { titulo: 'Reunião de kickoff', responsavel: 'agencia' },
      { titulo: 'Montar linha editorial', responsavel: 'agencia' },
    ],
    perguntas: [
      ...perguntasBase,
      P('perfis', 'Links dos perfis atuais', 'textarea'),
      P('tom', 'Como a marca deve falar? (formal, descontraída, técnica…)'),
      P('temas', 'Assuntos que não podem ser abordados', 'textarea', false),
    ],
  },
  outro: {
    itens: [
      { titulo: 'Responder o briefing', responsavel: 'cliente' },
      { titulo: 'Enviar materiais de referência', responsavel: 'cliente' },
      { titulo: 'Reunião de kickoff', responsavel: 'agencia' },
    ],
    perguntas: perguntasBase,
  },
}

export function modeloOnboarding(tipo: string | null | undefined) {
  return modelos[tipo ?? ''] ?? modelos.outro
}

// Copia o modelo para o projeto. Não faz nada se o projeto já tem onboarding.
export async function criarOnboarding(supabase: any, projetoId: string, tipo: string | null | undefined) {
  const { count } = await supabase.from('onboarding_itens').select('id', { count: 'exact', head: true }).eq('projeto_id', projetoId)
  if (count) return
  const modelo = modeloOnboarding(tipo)
  const { error } = await supabase.from('onboarding_itens').insert(
    modelo.itens.map((item, ordem) => ({ projeto_id: projetoId, titulo: item.titulo, descricao: item.descricao ?? null, responsavel: item.responsavel, ordem }))
  )
  if (error) throw error
  const { error: errBriefing } = await supabase
    .from('briefings')
    .upsert({ projeto_id: projetoId, perguntas: modelo.perguntas }, { onConflict: 'projeto_id', ignoreDuplicates: true })
  if (errBriefing) throw errBriefing
}

// O item "Responder o briefing" é marcado sozinho quando o briefing é enviado.
export const TITULO_ITEM_BRIEFING = 'Responder o briefing'

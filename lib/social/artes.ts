// ─── Gerador de artes ───
// Cada post guarda as lâminas em social_posts.artes: [{ template, dados }].
// Cada cliente tem um tema em social_temas. A arte é tema + template + dados,
// renderizada em 1080 × 1350 (components/social/artes/arte.tsx) e exportada em PNG.

export const LARGURA = 1080
export const ALTURA = 1350

export type Tema = {
  cores: {
    fundo: string       // fundo de todas as lâminas
    destaque: string    // faixa de preço, selos, detalhes (nunca o fundo inteiro)
    apoio: string       // textos de apoio e setas
    texto: string       // títulos e textos principais
    secundario: string  // rodapé e informações secundárias
  }
  fonte: string         // família carregada localmente (hoje: Poppins)
  logoUrl: string | null
  logoTexto: string     // usado enquanto não houver logo
  rodape: string
}

export const TEMA_PADRAO: Tema = {
  cores: { fundo: '#0E0B12', destaque: '#8B3FD1', apoio: '#C9A7F0', texto: '#FFFFFF', secundario: '#9A93A6' },
  fonte: 'Poppins',
  logoUrl: null,
  logoTexto: 'LOGO',
  rodape: '',
}

export const CORES_TEMA: { chave: keyof Tema['cores']; rotulo: string }[] = [
  { chave: 'fundo', rotulo: 'Fundo' },
  { chave: 'destaque', rotulo: 'Destaque' },
  { chave: 'apoio', rotulo: 'Apoio' },
  { chave: 'texto', rotulo: 'Texto' },
  { chave: 'secundario', rotulo: 'Secundário' },
]

// Junta o tema salvo com o padrão (temas antigos podem não ter todas as chaves).
export const completarTema = (t: Partial<Tema> | null | undefined): Tema =>
  ({ ...TEMA_PADRAO, ...t, cores: { ...TEMA_PADRAO.cores, ...t?.cores } })

// ─── Templates ───

export type IconeInfo = 'local' | 'horario' | 'envio' | 'whatsapp' | 'cartao' | 'loja'
export type ItemInfo = { icone: IconeInfo; texto: string }

export type DadosArte = {
  titulo?: string
  destaque?: string        // palavra(s) do título pintadas com a cor de destaque
  subtitulo?: string
  selo?: string
  seta?: string            // "Arrasta pro lado →"
  fotos?: string[]         // capa: fotos próprias (1 = grande, 2–4 = grade)
  fotosDosProdutos?: string // capa: '1' ou '4' usa as fotos das lâminas de produto; vazio = fotos próprias
  foto?: string
  categoria?: string
  marca?: string
  modelo?: string
  preco?: string
  parcelas?: string
  numeracoes?: string      // "35 36 37 38 39"
  genero?: string
  linha1?: string
  linha2?: string
  whatsapp?: string
  apoio?: string
  numero?: string
  texto?: string
  placeholder?: string     // texto do placeholder de foto
  itens?: ItemInfo[]
}

export type TemplateArte = 'capa' | 'produto' | 'chamada' | 'dica' | 'foto' | 'info'
export type Lamina = { template: TemplateArte; dados: DadosArte }

type TipoCampo = 'texto' | 'texto_longo' | 'foto' | 'fotos' | 'itens' | 'opcoes'
export type CampoArte = { chave: keyof DadosArte; rotulo: string; tipo: TipoCampo; ajuda?: string; opcoes?: [string, string][] }

export const TEMPLATES: Record<TemplateArte, { label: string; descricao: string; campos: CampoArte[]; padrao: DadosArte }> = {
  capa: {
    label: 'Capa',
    descricao: 'Título grande, selo e fotos (1 grande ou grade 2 × 2)',
    campos: [
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto_longo' },
      { chave: 'destaque', rotulo: 'Palavra em destaque', tipo: 'texto', ajuda: 'Trecho do título pintado na cor de destaque' },
      { chave: 'subtitulo', rotulo: 'Subtítulo', tipo: 'texto' },
      { chave: 'selo', rotulo: 'Selo', tipo: 'texto', ajuda: 'Ex.: Chegou na Mova' },
      { chave: 'fotosDosProdutos', rotulo: 'Fotos', tipo: 'opcoes', opcoes: [['', 'Fotos próprias'], ['1', '1ª lâmina de produto'], ['4', 'Grade com 4 produtos']] },
      { chave: 'fotos', rotulo: 'Fotos próprias', tipo: 'fotos', ajuda: '1 foto = grande; 2 a 4 = grade' },
      { chave: 'placeholder', rotulo: 'Texto sem foto', tipo: 'texto' },
      { chave: 'seta', rotulo: 'Texto no fim', tipo: 'texto' },
    ],
    padrao: { titulo: 'TÍTULO DA CAPA', seta: 'Arrasta pro lado →', fotos: [], placeholder: 'FOTO' },
  },
  produto: {
    label: 'Produto',
    descricao: 'Foto grande, marca, modelo, preço e numerações',
    campos: [
      { chave: 'categoria', rotulo: 'Etiqueta de categoria', tipo: 'texto', ajuda: 'Ex.: PRA ACADEMIA. Vazio = sem etiqueta' },
      { chave: 'foto', rotulo: 'Foto do produto', tipo: 'foto' },
      { chave: 'marca', rotulo: 'Marca', tipo: 'texto' },
      { chave: 'modelo', rotulo: 'Modelo', tipo: 'texto' },
      { chave: 'preco', rotulo: 'Preço', tipo: 'texto', ajuda: 'Ex.: R$ 299,90' },
      { chave: 'parcelas', rotulo: 'Parcelamento', tipo: 'texto', ajuda: 'Ex.: ou em até 3x no cartão' },
      { chave: 'numeracoes', rotulo: 'Numerações', tipo: 'texto', ajuda: 'Separadas por espaço: 35 36 37 38' },
      { chave: 'genero', rotulo: 'Linha final', tipo: 'texto', ajuda: 'Ex.: Feminino e masculino' },
      { chave: 'placeholder', rotulo: 'Texto sem foto', tipo: 'texto' },
    ],
    padrao: { marca: 'MARCA', modelo: 'Modelo exemplo', preco: 'R$ 000,00', parcelas: 'ou em até 3x no cartão', numeracoes: '35 36 37 38 39', placeholder: 'FOTO DO PRODUTO' },
  },
  chamada: {
    label: 'Chamada',
    descricao: 'Título em duas linhas e botão com o WhatsApp',
    campos: [
      { chave: 'linha1', rotulo: 'Linha 1', tipo: 'texto' },
      { chave: 'linha2', rotulo: 'Linha 2', tipo: 'texto' },
      { chave: 'whatsapp', rotulo: 'WhatsApp', tipo: 'texto' },
      { chave: 'apoio', rotulo: 'Linha de apoio', tipo: 'texto' },
    ],
    padrao: { linha1: 'GOSTOU?', linha2: 'CHAMA NO WHATSAPP', whatsapp: '(00) 00000-0000', apoio: '' },
  },
  dica: {
    label: 'Dica',
    descricao: 'Número grande, texto da dica e foto opcional',
    campos: [
      { chave: 'numero', rotulo: 'Número', tipo: 'texto' },
      { chave: 'texto', rotulo: 'Texto da dica', tipo: 'texto_longo' },
      { chave: 'foto', rotulo: 'Foto ou ícone (opcional)', tipo: 'foto' },
    ],
    padrao: { numero: '1', texto: 'Texto da dica' },
  },
  foto: {
    label: 'Foto',
    descricao: 'Foto em tela cheia com degradê, selo e título',
    campos: [
      { chave: 'foto', rotulo: 'Foto', tipo: 'foto' },
      { chave: 'selo', rotulo: 'Selo', tipo: 'texto' },
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto_longo' },
      { chave: 'placeholder', rotulo: 'Texto sem foto', tipo: 'texto' },
    ],
    padrao: { titulo: 'TÍTULO', placeholder: 'FOTO DA LOJA' },
  },
  info: {
    label: 'Informações',
    descricao: 'Lista de até 4 linhas com ícone',
    campos: [
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
      { chave: 'itens', rotulo: 'Linhas', tipo: 'itens' },
    ],
    padrao: { titulo: 'ONDE ESTAMOS', itens: [{ icone: 'local', texto: '[ENDEREÇO]' }, { icone: 'horario', texto: '[HORÁRIO]' }] },
  },
}

export const ICONES_INFO: Record<IconeInfo, string> = {
  local: 'Endereço', horario: 'Horário', envio: 'Envio', whatsapp: 'WhatsApp', cartao: 'Pagamento', loja: 'Loja',
}

export const novaLamina = (template: TemplateArte): Lamina =>
  ({ template, dados: structuredClone(TEMPLATES[template].padrao) })

// Fotos que a capa mostra: as próprias ou as das lâminas de produto do mesmo post.
export function fotosDaCapa(capa: DadosArte, laminas: Lamina[]): (string | null)[] {
  const n = Number(capa.fotosDosProdutos)
  if (n) return laminas.filter((l) => l.template === 'produto').slice(0, n).map((l) => l.dados.foto || null)
  const proprias = (capa.fotos ?? []).filter(Boolean).slice(0, 4)
  return proprias.length ? proprias : [null]
}

// "1/4" das lâminas de dica: posição entre as dicas do post.
export function progressoDica(laminas: Lamina[], indice: number) {
  const dicas = laminas.map((l, i) => (l.template === 'dica' ? i : -1)).filter((i) => i >= 0)
  return `${dicas.indexOf(indice) + 1}/${dicas.length}`
}

// ─── Tipo de conteúdo do post ───

export const TIPOS_CONTEUDO = {
  venda:        { label: 'Venda',        cor: '#B8F000' },
  autoridade:   { label: 'Autoridade',   cor: '#38BDF8' },
  conexao:      { label: 'Conexão',      cor: '#FF4D8D' },
  engajamento:  { label: 'Engajamento',  cor: '#F5A524' },
  institucional:{ label: 'Institucional', cor: '#A1A1AA' },
} as const
export type TipoConteudo = keyof typeof TIPOS_CONTEUDO

export const ERRO_MIGRATION_ARTES = 'Rode a migration 20261028000000_social_artes.sql no Supabase antes de usar.'

import { z } from 'zod'

// Briefing preenchido no admin. Tudo opcional menos o nome: quanto mais
// detalhe, melhor o resultado, mas dá para gerar só com o básico.
export type Briefing = {
  empresa: string
  segmento?: string
  cidade?: string
  descricao?: string        // o que a empresa faz
  publico?: string
  servicos?: string         // um por linha
  diferenciais?: string
  objetivo?: string         // ex.: gerar contatos no WhatsApp
  tom?: string
  estilo?: string
  corPrimaria?: string
  corSecundaria?: string
  secoes?: string[]
  logoUrl?: string
  fotos?: string[]
  whatsapp?: string
  telefone?: string
  email?: string
  endereco?: string
  instagram?: string
  siteAtual?: string
  referencias?: string
  observacoes?: string
}

export const TONS = ['Profissional', 'Próximo e acolhedor', 'Sofisticado', 'Jovem e descontraído', 'Técnico e direto']
export const ESTILOS = ['Moderno e minimalista', 'Elegante e premium', 'Vibrante e colorido', 'Corporativo e sóbrio', 'Aconchegante e artesanal']

export const SECOES: { value: string; label: string }[] = [
  { value: 'hero', label: 'Topo (chamada principal)' },
  { value: 'sobre', label: 'Sobre a empresa' },
  { value: 'servicos', label: 'Serviços / produtos' },
  { value: 'diferenciais', label: 'Diferenciais' },
  { value: 'numeros', label: 'Números / resultados' },
  { value: 'processo', label: 'Como funciona' },
  { value: 'galeria', label: 'Galeria / portfólio' },
  { value: 'depoimentos', label: 'Depoimentos' },
  { value: 'faq', label: 'Perguntas frequentes' },
  { value: 'cta', label: 'Chamada final' },
  { value: 'contato', label: 'Contato / localização' },
]
export const SECOES_PADRAO = ['hero', 'sobre', 'servicos', 'diferenciais', 'depoimentos', 'faq', 'contato']

// Textos do site, gerados pela IA e revisados por você antes do design.
// Ficam separados do HTML: quando o cliente fechar, viram o conteúdo do
// projeto em Next.js.
export const ConteudoSchema = z.object({
  titulo_pagina: z.string().describe('Título da aba do navegador / SEO (até ~60 caracteres)'),
  meta_descricao: z.string().describe('Descrição para o Google (até ~155 caracteres)'),
  slogan: z.string().describe('Frase curta de marca; vazio se não fizer sentido'),
  secoes: z.array(z.object({
    id: z.string().describe('Identificador curto em minúsculas, ex.: "servicos"'),
    tipo: z.enum(['hero', 'sobre', 'servicos', 'diferenciais', 'numeros', 'processo', 'galeria', 'depoimentos', 'faq', 'cta', 'contato']),
    titulo: z.string(),
    subtitulo: z.string().describe('Vazio se a seção não tiver'),
    texto: z.string().describe('Parágrafo(s) da seção; vazio se a seção for só de itens'),
    itens: z.array(z.object({
      titulo: z.string(),
      texto: z.string(),
    })).describe('Cards, serviços, perguntas do FAQ, depoimentos, números etc. Lista vazia se não houver'),
    botao: z.string().describe('Texto do botão de ação da seção; vazio se não tiver'),
  })),
})

export type Conteudo = z.infer<typeof ConteudoSchema>
export type SecaoConteudo = Conteudo['secoes'][number]

export const EdicaoSchema = z.object({
  resumo: z.string().describe('Uma frase, em português, dizendo o que foi alterado'),
  edicoes: z.array(z.object({
    procurar: z.string().describe('Trecho EXATO do HTML atual, copiado caractere por caractere, que aparece uma única vez'),
    substituir: z.string().describe('Novo trecho que entra no lugar'),
  })),
})

export type Edicao = z.infer<typeof EdicaoSchema>

export const STATUS_PREVIA: Record<string, { label: string; variant: 'default' | 'pendente' | 'aprovada' | 'urgente' | 'outline' }> = {
  rascunho: { label: 'Briefing', variant: 'outline' },
  conteudo: { label: 'Textos prontos', variant: 'default' },
  gerando: { label: 'Gerando…', variant: 'pendente' },
  pronto: { label: 'Prévia pronta', variant: 'aprovada' },
  erro: { label: 'Erro', variant: 'urgente' },
}

export function gerarSlug(nome: string) {
  const base = nome
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'previa'
  // Sufixo aleatório: o link não fica adivinhável a partir do nome.
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}

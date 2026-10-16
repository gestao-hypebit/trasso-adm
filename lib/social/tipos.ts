import { z } from 'zod'
import type { BadgeProps } from '@/components/ui/badge'

type Variante = NonNullable<BadgeProps['variant']>

export const REDES = {
  instagram: { label: 'Instagram', curto: 'IG', cor: '#E1306C' },
  facebook:  { label: 'Facebook',  curto: 'FB', cor: '#1877F2' },
  tiktok:    { label: 'TikTok',    curto: 'TT', cor: '#25F4EE' },
  linkedin:  { label: 'LinkedIn',  curto: 'IN', cor: '#0A66C2' },
  youtube:   { label: 'YouTube',   curto: 'YT', cor: '#FF0000' },
} as const
export type Rede = keyof typeof REDES

export const FORMATOS = {
  feed:      { label: 'Post (feed)', cor: '#7C3AED' },
  carrossel: { label: 'Carrossel',   cor: '#B8F000' },
  reels:     { label: 'Reels',       cor: '#FF4D8D' },
  stories:   { label: 'Stories',     cor: '#F5A524' },
  video:     { label: 'Vídeo',       cor: '#38BDF8' },
  artigo:    { label: 'Artigo',      cor: '#A1A1AA' },
} as const
export type Formato = keyof typeof FORMATOS

export const PRODUCAO = {
  ideia:     { label: 'Ideia',       variant: 'default' as Variante },
  producao:  { label: 'Em produção', variant: 'lead' as Variante },
  pronto:    { label: 'Pronto',      variant: 'ativo' as Variante },
  agendado:  { label: 'Agendado',    variant: 'outline' as Variante },
  publicado: { label: 'Publicado',   variant: 'concluido' as Variante },
} as const
export type Producao = keyof typeof PRODUCAO

export const APROVACAO = {
  pendente: { label: 'Aguardando cliente', variant: 'pendente' as Variante },
  aprovado: { label: 'Aprovado',           variant: 'aprovada' as Variante },
  ajustes:  { label: 'Pediu ajuste',       variant: 'recusada' as Variante },
} as const
export type Aprovacao = keyof typeof APROVACAO

export const STATUS_PLANEJAMENTO: Record<string, { label: string; variant: Variante }> = {
  rascunho: { label: 'Rascunho',          variant: 'default' },
  enviado:  { label: 'Com o cliente',     variant: 'pendente' },
  ajustes:  { label: 'Ajustes pedidos',   variant: 'recusada' },
  aprovado: { label: 'Aprovado',          variant: 'aprovada' },
}

export type Post = {
  id: string
  planejamento_id: string
  data: string
  horario: string | null
  redes: Rede[]
  formato: Formato
  titulo: string
  legenda: string | null
  hashtags: string | null
  roteiro: string | null
  cta: string | null
  midias: string[]
  producao: Producao
  aprovacao: Aprovacao
  comentario_cliente: string | null
  respondido_nome: string | null
  respondido_em: string | null
}

export type Planejamento = {
  id: string
  cliente_id: string
  titulo: string
  mes: string
  objetivo: string | null
  observacoes: string | null
  status: string
  token: string
  link_ativo: boolean
  enviado_em: string | null
  aprovado_em: string | null
  visualizacoes: number
  ultima_visualizacao: string | null
  updated_at: string
}

export const POST_VAZIO = {
  horario: '18:00', redes: ['instagram'] as Rede[], formato: 'feed' as Formato, titulo: '', legenda: '',
  hashtags: '', roteiro: '', cta: '', midias: [] as string[], producao: 'ideia' as Producao,
}

export const ERRO_MIGRATION = 'Rode a migration 20261016000000_social_media.sql no Supabase antes de usar.'

// "2026-11-01" → "novembro de 2026"
export function nomeMes(mes: string) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

// Dias (YYYY-MM-DD) do mês, para montar o calendário.
export function diasDoMes(mes: string) {
  const [y, m] = mes.split('-').map(Number)
  const total = new Date(y, m, 0).getDate()
  return Array.from({ length: total }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)
}

// Dia da semana do dia 1 (0 = domingo).
export const inicioDaSemana = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).getDay()
}

export const ordenarPosts = (posts: Post[]) =>
  [...posts].sort((a, b) => a.data.localeCompare(b.data) || (a.horario ?? '').localeCompare(b.horario ?? ''))

// Resumo da aprovação: o planejamento muda de status conforme os posts.
export function statusPelosPosts(posts: Pick<Post, 'aprovacao'>[], atual: string) {
  if (atual === 'rascunho' || !posts.length) return atual
  if (posts.some((p) => p.aprovacao === 'ajustes')) return 'ajustes'
  if (posts.every((p) => p.aprovacao === 'aprovado')) return 'aprovado'
  return 'enviado'
}

// ─── IA: sugestão de pauta ───

export const PautaSchema = z.object({
  posts: z.array(z.object({
    data: z.string().describe('YYYY-MM-DD, dentro do mês pedido'),
    horario: z.string().describe('HH:MM'),
    formato: z.enum(['feed', 'carrossel', 'reels', 'stories', 'video', 'artigo']),
    titulo: z.string().describe('tema/pauta em poucas palavras'),
    legenda: z.string(),
    hashtags: z.string().describe('hashtags separadas por espaço'),
    roteiro: z.string().describe('briefing da arte, texto de cada slide ou roteiro do vídeo'),
    cta: z.string(),
  })),
})
export type Pauta = z.infer<typeof PautaSchema>

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
  mes: string                   // primeiro dia do período
  data_fim: string | null       // último dia; vazio = fim do mês de "mes"
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
export const ERRO_MIGRATION_PERIODO = 'Rode a migration 20261019000000_social_periodo.sql no Supabase antes de usar.'

const pad = (n: number) => String(n).padStart(2, '0')

// "2026-11-01" → "novembro de 2026"
export function nomeMes(mes: string) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

// Último dia do período. Sem data_fim, o planejamento é do mês cheio de "inicio".
export function fimDoPeriodo(inicio: string, fim?: string | null) {
  if (fim) return fim
  const [y, m] = inicio.split('-').map(Number)
  return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`
}

// "2026-11-01" a "2026-11-30" → "Novembro de 2026"; "2026-10-20" a "2026-11-19" → "20/10 a 19/11/2026"
export function nomePeriodo(inicio: string, fim?: string | null) {
  const f = fimDoPeriodo(inicio, fim)
  if (inicio.endsWith('-01') && f === fimDoPeriodo(inicio)) {
    const nome = nomeMes(inicio)
    return nome.charAt(0).toUpperCase() + nome.slice(1)
  }
  const [yi, mi, di] = inicio.split('-')
  const [yf, mf, df] = f.split('-')
  return yi === yf ? `${di}/${mi} a ${df}/${mf}/${yf}` : `${di}/${mi}/${yi} a ${df}/${mf}/${yf}`
}

// Fim sugerido para um período que começa em `inicio`: a véspera do mesmo dia no mês seguinte.
// "2026-10-20" → "2026-11-19"; "2026-10-01" → "2026-10-31".
export function umMesDepois(inicio: string) {
  const [y, m, d] = inicio.split('-').map(Number)
  const dia = new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()) - 1)
  return `${dia.getFullYear()}-${pad(dia.getMonth() + 1)}-${pad(dia.getDate())}`
}

// Dias (YYYY-MM-DD) do período, para montar o calendário.
export function diasDoPeriodo(inicio: string, fim?: string | null) {
  const f = fimDoPeriodo(inicio, fim)
  const [y, m, d] = inicio.split('-').map(Number)
  const dias: string[] = []
  for (let dia = new Date(y, m - 1, d); ; dia.setDate(dia.getDate() + 1)) {
    const iso = `${dia.getFullYear()}-${pad(dia.getMonth() + 1)}-${pad(dia.getDate())}`
    if (iso > f) return dias
    dias.push(iso)
  }
}

// Dia da semana do primeiro dia (0 = domingo).
export const inicioDaSemana = (inicio: string) => {
  const [y, m, d] = inicio.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
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
    data: z.string().describe('YYYY-MM-DD, dentro do período pedido'),
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

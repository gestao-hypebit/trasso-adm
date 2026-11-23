import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanejamentoPorToken } from '@/lib/social/publico'
import { ehFormatoVideo, type Post } from '@/lib/social/tipos'
import { AprovacaoCliente } from '@/components/social/aprovacao-cliente'
import { AvisoPublico } from '@/components/social/aviso-publico'

export const metadata: Metadata = {
  title: 'Post para aprovação — Slick',
  robots: { index: false, follow: false },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Link de um post só: o cliente vê e aprova apenas este post, sem o calendário.
// Funciona mesmo com o planejamento em rascunho (dá para mandar um post antes do resto).
// ?admin=1 não conta visualização.
export default async function PostAvulsoPage({ params, searchParams }: {
  params: Promise<{ token: string; postId: string }>
  searchParams: Promise<{ admin?: string }>
}) {
  const { token, postId } = await params
  const { admin } = await searchParams
  const indisponivel = <AvisoPublico titulo="Post indisponível" texto="Este link não está mais ativo. Fale com a Slick para receber um novo." />

  const plano = await getPlanejamentoPorToken(token)
  if (!plano || !UUID_RE.test(postId)) return indisponivel

  const supabase = createServiceClient() as any
  const [{ data: post }, { data: config }] = await Promise.all([
    supabase.from('social_posts')
      .select('id, planejamento_id, data, horario, redes, formato, titulo, legenda, hashtags, roteiro, cta, midias, producao, aprovacao, comentario_cliente, respondido_nome, respondido_em')
      .eq('id', postId)
      .eq('planejamento_id', plano.id)
      .maybeSingle(),
    supabase.from('configuracoes_agencia').select('nome, logo_url').limit(1).maybeSingle(),
    admin !== '1' ? supabase.rpc('social_planejamento_visualizar', { p_token: token }) : null,
  ])
  if (!post) return indisponivel

  // O briefing interno da arte não pode chegar ao navegador do cliente.
  const doCliente = (ehFormatoVideo(post.formato) ? post : { ...post, roteiro: null }) as Post

  return (
    <AprovacaoCliente
      token={token}
      plano={plano}
      posts={[doCliente]}
      agenciaNome={config?.nome ?? 'Slick'}
      logoUrl={config?.logo_url ?? null}
      previa={false}
      avulso
    />
  )
}

import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanejamentoPorToken } from '@/lib/social/publico'
import { ordenarPosts, type Post } from '@/lib/social/tipos'
import { AprovacaoCliente } from '@/components/social/aprovacao-cliente'

export const metadata: Metadata = {
  title: 'Planejamento de conteúdo — Slick',
  robots: { index: false, follow: false },
}

// Link que vai para o cliente: ele vê o calendário e aprova cada post.
// ?admin=1 (botão "Ver" no admin) não conta visualização e mostra rascunhos.
export default async function PlanoPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ admin?: string }> }) {
  const { token } = await params
  const { admin } = await searchParams
  const plano = await getPlanejamentoPorToken(token)

  if (!plano) return <Aviso titulo="Planejamento indisponível" texto="Este link não está mais ativo. Fale com a Slick para receber um novo." />
  if (plano.status === 'rascunho' && admin !== '1') return <Aviso titulo="Planejamento em preparação" texto="Volte daqui a pouco." />

  const supabase = createServiceClient() as any
  // roteiro fica de fora: é o briefing interno da arte, o cliente não vê.
  const [{ data: posts }, { data: config }] = await Promise.all([
    supabase.from('social_posts')
      .select('id, planejamento_id, data, horario, redes, formato, titulo, legenda, hashtags, cta, midias, producao, aprovacao, comentario_cliente, respondido_nome, respondido_em')
      .eq('planejamento_id', plano.id),
    supabase.from('configuracoes_agencia').select('nome, logo_url').limit(1).maybeSingle(),
    admin !== '1' ? supabase.rpc('social_planejamento_visualizar', { p_token: token }) : null,
  ])

  return (
    <AprovacaoCliente
      token={token}
      plano={plano}
      posts={ordenarPosts((posts ?? []) as Post[])}
      agenciaNome={config?.nome ?? 'Slick'}
      logoUrl={config?.logo_url ?? null}
      previa={plano.status === 'rascunho'}
    />
  )
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-brand-noite p-6 text-center">
      <div>
        <p className="mb-2 text-xl font-semibold text-brand-lavanda">{titulo}</p>
        <p className="text-brand-lavanda/60">{texto}</p>
      </div>
    </div>
  )
}

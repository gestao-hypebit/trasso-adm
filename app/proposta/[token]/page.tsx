import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { PaginaProposta } from '@/components/proposta-publica/pagina'

export const metadata: Metadata = {
  title: 'Proposta — Slick',
  robots: { index: false, follow: false },
}

// Link curto: /proposta/<slug>, ex.: /proposta/dj-turin-k7m2.
// O segmento se chama [token] porque divide o nível com /proposta/[token]/[id];
// aqui ele é o slug da proposta. A página é a mesma do link longo, sem redirecionar.
export default async function PropostaLinkCurtoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: slug } = await params
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) notFound()

  const supabase = createServiceClient() as any
  const { data } = await supabase
    .from('propostas')
    .select('id, clientes(portal_token, portal_ativo)')
    .eq('slug', slug)
    .neq('status', 'rascunho')
    .maybeSingle()
  const cliente = data?.clientes as { portal_token: string; portal_ativo: boolean } | null
  if (!data || !cliente?.portal_ativo) notFound()

  return <PaginaProposta token={cliente.portal_token} id={data.id} />
}

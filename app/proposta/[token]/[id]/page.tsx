import type { Metadata } from 'next'
import { PaginaProposta } from '@/components/proposta-publica/pagina'

export const metadata: Metadata = {
  title: 'Proposta — Slick',
  robots: { index: false, follow: false },
}

// Link longo: /proposta/<token do portal>/<id da proposta>.
export default async function PropostaPublicaPage({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params
  return <PaginaProposta token={token} id={id} />
}

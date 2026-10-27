import { ClienteSocial } from '@/components/social/cliente-social'

export default async function ClienteSocialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ClienteSocial id={id} />
}

import { PlanejamentoWorkspace } from '@/components/social/planejamento-workspace'

export default async function PlanejamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PlanejamentoWorkspace id={id} />
}

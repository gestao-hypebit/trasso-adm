import { PreviaWorkspace } from '@/components/sites/previa-workspace'

// ?gerar=1 (vindo de "Criar e gerar textos") já começa a escrever os textos.
export default async function PreviaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gerar?: string }> }) {
  const { id } = await params
  const { gerar } = await searchParams
  return <PreviaWorkspace id={id} autoGerar={gerar === '1'} />
}

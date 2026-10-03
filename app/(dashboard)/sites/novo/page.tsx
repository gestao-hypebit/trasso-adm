import { NovaPrevia } from '@/components/sites/nova-previa'

// ?lead=<id> ou ?cliente=<id> já deixa a prévia vinculada.
export default async function NovaPreviaPage({ searchParams }: { searchParams: Promise<{ lead?: string; cliente?: string }> }) {
  const { lead, cliente } = await searchParams
  return <NovaPrevia leadInicial={lead} clienteInicial={cliente} />
}

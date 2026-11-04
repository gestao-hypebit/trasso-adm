import { ContasPage } from '@/components/financeiro/contas-page'

export default async function ContasAPagarPage({ searchParams }: { searchParams: Promise<{ aba?: string | string[] }> }) {
  const { aba } = await searchParams
  return <ContasPage tipo="despesa" abaInicial={aba === 'vencidas' ? 'vencidas' : undefined} />
}

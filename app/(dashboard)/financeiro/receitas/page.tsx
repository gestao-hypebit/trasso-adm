import { ContasPage } from '@/components/financeiro/contas-page'

export default async function ContasAReceberPage({ searchParams }: { searchParams: Promise<{ aba?: string | string[] }> }) {
  const { aba } = await searchParams
  return <ContasPage tipo="receita" abaInicial={aba === 'vencidas' ? 'vencidas' : undefined} />
}

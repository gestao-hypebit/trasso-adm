import { MrrTela, type AbaMrr } from '@/components/recorrencia/mrr-tela'

// MRR e assinaturas: visão geral da agência + listas do Catálogo Place e de Serviços.
// A aba vem do endereço (?aba=catalogo | servicos) para dar para linkar direto.
export default async function MrrPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams
  const abaInicial: AbaMrr = aba === 'catalogo' || aba === 'servicos' ? aba : 'geral'
  return <MrrTela abaInicial={abaInicial} />
}

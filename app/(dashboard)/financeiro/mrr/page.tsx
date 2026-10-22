import { MrrTela, type AbaMrr } from '@/components/recorrencia/mrr-tela'

const ABAS_DE_LINHA = ['catalogo', 'clubelly', 'servicos'] as const

// MRR e assinaturas: visão geral da agência + listas do Catálogo Place, da Clubelly e de Serviços.
// A aba vem do endereço (?aba=catalogo | clubelly | servicos) para dar para linkar direto.
// ?lista=atraso abre a visão geral já na lista "Para cobrar" (link do aviso da régua).
export default async function MrrPage({ searchParams }: { searchParams: Promise<{ aba?: string; lista?: string }> }) {
  const { aba, lista } = await searchParams
  const abaInicial: AbaMrr = ABAS_DE_LINHA.find((a) => a === aba) ?? 'geral'
  return <MrrTela abaInicial={abaInicial} focoCobranca={lista === 'atraso'} />
}

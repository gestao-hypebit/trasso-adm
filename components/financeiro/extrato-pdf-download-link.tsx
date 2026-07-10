'use client'

import dynamic from 'next/dynamic'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExtratoComissaoPDF, type ExtratoComissaoRow, type ExtratoIndicador } from '@/components/financeiro/extrato-comissao-pdf'
import { slugify } from '@/lib/utils'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFDownloadLink),
  { ssr: false, loading: () => <Button variant="outline" disabled><Loader2 className="h-4 w-4 animate-spin" />Gerando PDF...</Button> }
)

export function ExtratoPdfDownloadLink({
  indicador, comissoes, periodoLabel, periodoArquivo, logoUrl, agenciaNome,
}: {
  indicador: ExtratoIndicador
  comissoes: ExtratoComissaoRow[]
  periodoLabel: string
  periodoArquivo: string
  logoUrl: string | null
  agenciaNome: string
}) {
  const fileName = `extrato-comissao-${slugify(indicador.nome)}-${periodoArquivo}.pdf`

  return (
    <PDFDownloadLink
      document={<ExtratoComissaoPDF indicador={indicador} comissoes={comissoes} periodoLabel={periodoLabel} logoUrl={logoUrl} agenciaNome={agenciaNome} />}
      fileName={fileName}
    >
      {({ loading }: { loading: boolean }) => (
        <Button disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {loading ? 'Gerando PDF...' : 'Baixar PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  )
}

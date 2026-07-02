'use client'

import dynamic from 'next/dynamic'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PropostaPDF } from '@/components/propostas/proposta-pdf'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFDownloadLink),
  { ssr: false, loading: () => <Button variant="outline" size="sm" disabled><Loader2 className="h-4 w-4 animate-spin" />PDF</Button> }
)

type Item = { id: string; descricao: string; quantidade: number; valor_unitario: number; ordem: number; recorrencia?: string }
type Proposta = {
  numero: string; titulo: string; descricao: string | null; status: string
  validade: string | null; condicoes_pagamento: string | null; observacoes: string | null
  created_at: string; desconto_percentual: number; valor_total: number
  clientes: { nome: string; empresa: string | null; email: string | null } | null
  proposta_itens: Item[]
}

export function PdfDownloadLinkClient({ proposta, logoUrl, agenciaNome }: {
  proposta: Proposta
  logoUrl: string | null
  agenciaNome: string
}) {
  return (
    <PDFDownloadLink document={<PropostaPDF proposta={proposta} logoUrl={logoUrl} agenciaNome={agenciaNome} />} fileName={`${proposta.numero}.pdf`}>
      {({ loading }: { loading: boolean }) => (
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          PDF
        </Button>
      )}
    </PDFDownloadLink>
  )
}

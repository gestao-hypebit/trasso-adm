import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { AssinarContratoButton } from '@/components/portal/assinar-contrato-button'

export type ContratoCardData = {
  id: string; numero: string; titulo: string; tipo: string | null; status: string
  valor_total: number; data_inicio: string | null; data_fim: string | null
  condicoes_pagamento: string | null; arquivo_url: string | null; assinado_em: string | null
}

const STATUS_CONFIG = {
  enviado:   { label: 'Enviado',   variant: 'default' as const },
  assinado:  { label: 'Assinado',  variant: 'aprovada' as const },
  encerrado: { label: 'Encerrado', variant: 'inativo' as const },
  cancelado: { label: 'Cancelado', variant: 'recusada' as const },
}

export function ContratoCard({ token, contrato }: { token: string; contrato: ContratoCardData }) {
  const sc = STATUS_CONFIG[contrato.status as keyof typeof STATUS_CONFIG]

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-brand-lavanda/50">{contrato.numero}</span>
              {sc && <Badge variant={sc.variant}>{sc.label}</Badge>}
            </div>
            <h3 className="text-lg font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{contrato.titulo}</h3>
            <p className="text-xs text-brand-lavanda/40 mt-1">
              Vigência: {contrato.data_inicio ? formatDate(contrato.data_inicio) : '—'} → {contrato.data_fim ? formatDate(contrato.data_fim) : 'Indefinido'}
            </p>
          </div>
          <p className="text-xl font-bold text-brand-lima shrink-0" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {formatCurrency(contrato.valor_total)}
          </p>
        </div>

        {contrato.condicoes_pagamento && (
          <div className="mb-4 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <p className="text-xs text-brand-lavanda/50 mb-1">Condições de Pagamento</p>
            <p className="text-sm text-brand-lavanda/80">{contrato.condicoes_pagamento}</p>
          </div>
        )}

        {contrato.assinado_em && (
          <p className="text-xs text-brand-lima mb-4">Assinado em {formatDate(contrato.assinado_em)}</p>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
          {contrato.arquivo_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={contrato.arquivo_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Abrir PDF
              </a>
            </Button>
          )}
          {contrato.status === 'enviado' && (
            <AssinarContratoButton token={token} contratoId={contrato.id} numero={contrato.numero} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

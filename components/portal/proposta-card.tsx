import { RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PdfDownloadLinkClient } from '@/components/portal/pdf-download-link-client'
import { AprovarPropostaButton } from '@/components/portal/aprovar-proposta-button'
import { RecusarPropostaButton } from '@/components/portal/recusar-proposta-button'

type Item = { id: string; descricao: string; quantidade: number; valor_unitario: number; ordem: number; recorrencia?: string }
export type PropostaCardData = {
  id: string; numero: string; titulo: string; descricao: string | null; status: string
  validade: string | null; condicoes_pagamento: string | null; observacoes: string | null
  created_at: string; desconto_percentual: number; valor_total: number
  clientes: { nome: string; empresa: string | null; email: string | null } | null
  proposta_itens: Item[]
}

const STATUS_CONFIG = {
  enviada:       { label: 'Enviada',       variant: 'default' as const },
  em_negociacao: { label: 'Em Negociação', variant: 'pendente' as const },
  aprovada:      { label: 'Aprovada',      variant: 'aprovada' as const },
  recusada:      { label: 'Recusada',      variant: 'recusada' as const },
  expirada:      { label: 'Expirada',      variant: 'inativo' as const },
}

export function PropostaCard({ token, proposta, logoUrl, agenciaNome }: {
  token: string
  proposta: PropostaCardData
  logoUrl: string | null
  agenciaNome: string
}) {
  const sc = STATUS_CONFIG[proposta.status as keyof typeof STATUS_CONFIG]
  const itens = [...proposta.proposta_itens].sort((a, b) => a.ordem - b.ordem)
  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)
  const desconto = subtotal * (proposta.desconto_percentual / 100)
  const total = subtotal - desconto
  const podeDecidir = proposta.status === 'enviada' || proposta.status === 'em_negociacao'

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-brand-lavanda/50">{proposta.numero}</span>
              {sc && <Badge variant={sc.variant}>{sc.label}</Badge>}
            </div>
            <h3 className="text-lg font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{proposta.titulo}</h3>
            {proposta.descricao && <p className="text-sm text-brand-lavanda/60 mt-1">{proposta.descricao}</p>}
          </div>
          <PdfDownloadLinkClient proposta={proposta} logoUrl={logoUrl} agenciaNome={agenciaNome} />
        </div>

        {itens.length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs text-brand-lavanda/40 font-medium py-2">Serviço / Entregável</th>
                <th className="text-center text-xs text-brand-lavanda/40 font-medium py-2 w-16">Qtd</th>
                <th className="text-right text-xs text-brand-lavanda/40 font-medium py-2 w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id} className="border-b border-white/[0.04]">
                  <td className="py-2.5 text-brand-lavanda">
                    {item.descricao}
                    {item.recorrencia && item.recorrencia !== 'avulso' && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-brand-violeta/15 text-brand-violeta capitalize inline-flex items-center gap-1">
                        <RefreshCw className="h-2.5 w-2.5" />{item.recorrencia}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-center text-brand-lavanda/60">{item.quantidade}</td>
                  <td className="py-2.5 text-right font-medium text-brand-lavanda">{formatCurrency(item.quantidade * item.valor_unitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-end mb-4">
          <div className="w-56 space-y-1.5">
            {proposta.desconto_percentual > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-brand-lavanda/60">Desconto ({proposta.desconto_percentual}%)</span>
                <span className="text-brand-rosa">−{formatCurrency(desconto)}</span>
              </div>
            )}
            <Separator className="bg-brand-violeta/20" />
            <div className="flex justify-between">
              <span className="font-bold text-brand-lavanda">Total</span>
              <span className="font-bold text-brand-lima text-lg">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {proposta.condicoes_pagamento && (
          <div className="mb-4 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <p className="text-xs text-brand-lavanda/50 mb-1">Condições de Pagamento</p>
            <p className="text-sm text-brand-lavanda/80">{proposta.condicoes_pagamento}</p>
          </div>
        )}

        {proposta.validade && (
          <p className="text-xs text-brand-lavanda/40 mb-4">Válida até {formatDate(proposta.validade)}</p>
        )}

        {podeDecidir && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
            <AprovarPropostaButton token={token} propostaId={proposta.id} numero={proposta.numero} />
            <RecusarPropostaButton token={token} propostaId={proposta.id} numero={proposta.numero} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

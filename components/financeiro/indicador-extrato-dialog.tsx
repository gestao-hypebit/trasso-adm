'use client'

import { useMemo, useState } from 'react'
import { FileText, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ExtratoPdfDownloadLink } from '@/components/financeiro/extrato-pdf-download-link'
import type { ExtratoComissaoRow, ExtratoIndicador } from '@/components/financeiro/extrato-comissao-pdf'

const statusConfig: Record<string, { label: string; variant: 'concluido' | 'pendente' | 'inativo' }> = {
  pago: { label: 'Pago', variant: 'concluido' },
  pendente: { label: 'Pendente', variant: 'pendente' },
  cancelado: { label: 'Cancelado', variant: 'inativo' },
}

function toWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
}

interface IndicadorExtratoDialogProps {
  indicador: ExtratoIndicador & { id: string; whatsapp: string | null; telefone: string | null }
  comissoes: ExtratoComissaoRow[]
  logoUrl: string | null
  agenciaNome: string
}

export function IndicadorExtratoDialog({ indicador, comissoes, logoUrl, agenciaNome }: IndicadorExtratoDialogProps) {
  const [open, setOpen] = useState(false)
  const [desde, setDesde] = useState('')
  const [ate, setAte] = useState('')

  const comissoesFiltradas = useMemo(() => {
    return comissoes
      .filter((c) => (!desde || c.competencia.slice(0, 7) >= desde) && (!ate || c.competencia.slice(0, 7) <= ate))
      .sort((a, b) => b.competencia.localeCompare(a.competencia))
  }, [comissoes, desde, ate])

  const { periodoLabel, periodoArquivo } = useMemo(() => {
    if (!desde && !ate) return { periodoLabel: 'Todo o período', periodoArquivo: 'todo-periodo' }
    const fmtLabel = (v: string) => format(new Date(v + '-01T12:00:00Z'), 'MMMM yyyy', { locale: ptBR })
    if (desde && ate && desde !== ate) {
      return { periodoLabel: `${fmtLabel(desde)} a ${fmtLabel(ate)}`, periodoArquivo: `${desde}_${ate}` }
    }
    const unico = desde || ate
    return { periodoLabel: fmtLabel(unico), periodoArquivo: unico }
  }, [desde, ate])

  const totalGeral = comissoesFiltradas.reduce((s, c) => s + c.valor, 0)
  const totalPago = comissoesFiltradas.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalPendente = comissoesFiltradas.filter(c => c.status === 'pendente').reduce((s, c) => s + c.valor, 0)

  const telefoneContato = indicador.whatsapp || indicador.telefone
  const whatsappHref = telefoneContato
    ? `https://wa.me/${toWhatsAppNumber(telefoneContato)}?text=${encodeURIComponent(
        `Olá ${indicador.nome}! Segue seu extrato de comissões (${periodoLabel.toLowerCase()}): total de ${formatCurrency(totalGeral)}. Vou anexar o PDF aqui em seguida.`
      )}`
    : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex h-7 w-7 items-center justify-center rounded-md text-brand-lavanda/40 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors">
          <FileText className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extrato de {indicador.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">De</Label>
              <Input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Até</Label>
              <Input type="month" value={ate} onChange={(e) => setAte(e.target.value)} min={desde || undefined} />
            </div>
          </div>
          {(desde || ate) && (
            <button onClick={() => { setDesde(''); setAte('') }} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 transition-colors -mt-2">
              Limpar período (ver tudo)
            </button>
          )}

          <div className="rounded-xl border border-white/[0.08] overflow-hidden">
            <div className="max-h-52 overflow-y-auto">
              {comissoesFiltradas.length === 0 ? (
                <p className="text-xs text-brand-lavanda/40 text-center py-8">Nenhuma comissão nesse período.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {comissoesFiltradas.map((c) => {
                      const sc = statusConfig[c.status]
                      return (
                        <tr key={c.id} className="border-b border-white/[0.04] last:border-0">
                          <td className="px-3 py-2 text-xs text-brand-lavanda/70 capitalize">
                            {format(new Date(c.competencia + 'T12:00:00Z'), 'MMM yyyy', { locale: ptBR })}
                          </td>
                          <td className="px-3 py-2 text-xs text-brand-lavanda/50">{c.clienteIndicadoNome}</td>
                          <td className="px-3 py-2 text-center">{sc && <Badge variant={sc.variant}>{sc.label}</Badge>}</td>
                          <td className="px-3 py-2 text-xs text-right font-medium text-brand-lavanda whitespace-nowrap">{formatCurrency(c.valor)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02] border-t border-white/[0.08] text-xs">
              <span className="text-brand-lavanda/50">Pago {formatCurrency(totalPago)} · Pendente {formatCurrency(totalPendente)}</span>
              <span className="font-semibold text-brand-lavanda">{formatCurrency(totalGeral)}</span>
            </div>
          </div>

          {!telefoneContato && (
            <p className="text-xs text-brand-lavanda/40">Cadastre um telefone/WhatsApp no indicador para habilitar o envio direto.</p>
          )}
        </div>

        <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={cn('w-full sm:w-auto')}>
              <Button variant="outline" className="w-full">
                <MessageCircle className="h-4 w-4" />
                Enviar por WhatsApp
              </Button>
            </a>
          )}
          <ExtratoPdfDownloadLink
            indicador={indicador}
            comissoes={comissoesFiltradas}
            periodoLabel={periodoLabel}
            periodoArquivo={periodoArquivo}
            logoUrl={logoUrl}
            agenciaNome={agenciaNome}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

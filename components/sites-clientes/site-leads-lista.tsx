'use client'

import { useState } from 'react'
import { ChevronDown, MessageCircle, Mail, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatDate, whatsappUrl } from '@/lib/utils'
import { SITE_LEAD_STATUS, siteLeadStatusConfig, valorResposta, type SiteLead, type SiteLeadStatus } from '@/lib/sites-clientes/leads'

// Lista de leads de um site. Usada no administrativo e na área do cliente
// (com troca de status e exclusão) e no portal por link (só leitura).
export function SiteLeadsLista({ leads, onMudarStatus, onExcluir }: {
  leads: SiteLead[]
  onMudarStatus?: (id: string, status: SiteLeadStatus) => void
  onExcluir?: (id: string) => void
}) {
  const [aberto, setAberto] = useState<string | null>(null)

  return (
    <div className="divide-y divide-white/[0.06]">
      {leads.map((l) => {
        const expandido = aberto === l.id
        const wpp = whatsappUrl(l.telefone, `Olá, ${l.nome.split(' ')[0]}! Recebemos seu contato pelo site.`)
        const status = siteLeadStatusConfig[l.status] ?? siteLeadStatusConfig.novo
        return (
          <div key={l.id} className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setAberto(expandido ? null : l.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-brand-lavanda/30 transition-transform', expandido && 'rotate-180')} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-lavanda">{l.nome}</p>
                  <p className="truncate text-xs text-brand-lavanda/40">
                    {formatDate(l.created_at, 'dd/MM/yyyy HH:mm')}
                    {l.formulario !== 'contato' && <> · {l.formulario}</>}
                    {l.telefone && <> · {l.telefone}</>}
                    {!l.telefone && l.email && <> · {l.email}</>}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-1.5">
                {wpp && (
                  <a href={wpp} target="_blank" rel="noopener noreferrer" title="Chamar no WhatsApp"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-brand-lavanda/50 hover:bg-white/[0.05] hover:text-brand-lima">
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
                {l.email && (
                  <a href={`mailto:${l.email}`} title="Enviar e-mail"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-brand-lavanda/50 hover:bg-white/[0.05] hover:text-brand-lavanda">
                    <Mail className="h-4 w-4" />
                  </a>
                )}
                {onMudarStatus ? (
                  <Select value={l.status} onValueChange={(s) => onMudarStatus(l.id, s as SiteLeadStatus)}>
                    <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SITE_LEAD_STATUS.map((s) => <SelectItem key={s} value={s}>{siteLeadStatusConfig[s].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={status.variant}>{status.label}</Badge>
                )}
                {onExcluir && (
                  <button type="button" title="Excluir contato" aria-label={`Excluir ${l.nome}`}
                    onClick={() => { if (window.confirm(`Excluir o contato de ${l.nome}? Não dá para desfazer.`)) onExcluir(l.id) }}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-brand-lavanda/35 hover:bg-white/[0.05] hover:text-brand-rosa">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {expandido && (
              <dl className="mt-3 grid gap-2 rounded-lg bg-white/[0.02] p-3 text-sm sm:grid-cols-2">
                {l.email && <Campo rotulo="E-mail" valor={l.email} />}
                {l.telefone && <Campo rotulo="Telefone" valor={l.telefone} />}
                {(l.respostas ?? []).map((r) => (
                  <Campo key={r.chave} rotulo={r.rotulo} valor={valorResposta(r.valor)} largo={valorResposta(r.valor).length > 60} />
                ))}
                {l.pagina && <Campo rotulo="Página" valor={l.pagina} largo />}
                {l.utm?.utm_source && <Campo rotulo="Origem" valor={[l.utm.utm_source, l.utm.utm_campaign].filter(Boolean).join(' · ')} />}
              </dl>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Campo({ rotulo, valor, largo }: { rotulo: string; valor: string; largo?: boolean }) {
  return (
    <div className={cn(largo && 'sm:col-span-2')}>
      <dt className="text-[11px] uppercase tracking-wide text-brand-lavanda/35">{rotulo}</dt>
      <dd className="whitespace-pre-wrap break-words text-brand-lavanda/80">{valor}</dd>
    </div>
  )
}

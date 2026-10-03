'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, Loader2, MessageSquareWarning } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn, formatDate } from '@/lib/utils'
import { responderEntrega } from '@/app/portal/[token]/actions'
import { entregaStatusConfig, eventoLabel, labelEntregaTipo, ordenarEventos, type Entrega } from '@/lib/projetos/entregas'

const statusPortal = {
  ...entregaStatusConfig,
  aguardando: { label: 'Aguardando sua aprovação', variant: 'pendente' as const },
  ajustes: { label: 'Ajustes em andamento', variant: 'default' as const },
}

export function EntregaCard({ token, entrega, projetoNome, clienteNome }: { token: string; entrega: Entrega; projetoNome: string; clienteNome: string }) {
  const router = useRouter()
  const [acao, setAcao] = useState<'aprovar' | 'ajustes' | null>(null)
  const [nome, setNome] = useState(clienteNome)
  const [comentario, setComentario] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()
  const sc = statusPortal[entrega.status]

  function confirmar() {
    setErro(null)
    startTransition(async () => {
      const r = await responderEntrega(token, entrega.id, { aprovar: acao === 'aprovar', nome, comentario })
      if (r.success) {
        setAcao(null)
        setComentario('')
        router.refresh()
      } else {
        setErro(r.error)
      }
    })
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Badge variant={sc.variant}>{sc.label}</Badge>
          <span className="text-xs text-brand-lavanda/40">{projetoNome} · {labelEntregaTipo(entrega.tipo)} · versão {entrega.rodada}</span>
        </div>
        <h3 className="text-lg font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{entrega.titulo}</h3>

        {entrega.link && (
          <Button size="sm" variant="outline" asChild className="mt-3">
            <a href={entrega.link} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Abrir para ver</a>
          </Button>
        )}

        <ol className="mt-4 space-y-2 border-l border-white/[0.08] pl-4">
          {ordenarEventos(entrega.entrega_eventos).map((ev) => (
            <li key={ev.id} className="relative">
              <span className={cn(
                'absolute -left-[21px] top-1.5 h-2 w-2 rounded-full',
                ev.tipo === 'aprovada' ? 'bg-brand-lima' : ev.tipo === 'ajustes' ? 'bg-brand-rosa' : 'bg-brand-violeta'
              )} />
              <p className="text-xs text-brand-lavanda/60">
                <span className="font-medium text-brand-lavanda">{ev.autor === 'agencia' && ev.tipo === 'enviada' ? `Versão ${ev.rodada} enviada pela Trasso` : eventoLabel[ev.tipo]}</span>
                {ev.autor === 'cliente' && ev.nome && <> · {ev.nome}</>}
                {' · '}{formatDate(ev.created_at, "dd/MM 'às' HH:mm")}
              </p>
              {ev.comentario && <p className="mt-0.5 whitespace-pre-wrap text-sm text-brand-lavanda/80">{ev.comentario}</p>}
            </li>
          ))}
        </ol>

        {entrega.status === 'aguardando' && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
            <Button size="sm" onClick={() => setAcao('aprovar')}><CheckCircle2 className="h-4 w-4" /> Aprovar</Button>
            <Button size="sm" variant="outline" onClick={() => setAcao('ajustes')}><MessageSquareWarning className="h-4 w-4" /> Pedir ajustes</Button>
          </div>
        )}
      </CardContent>

      <Dialog open={!!acao} onOpenChange={(open) => !open && setAcao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{acao === 'aprovar' ? `Aprovar "${entrega.titulo}"` : `Pedir ajustes em "${entrega.titulo}"`}</DialogTitle>
            <DialogDescription>
              {acao === 'aprovar'
                ? 'Ao aprovar, você confirma que esta versão está de acordo e a Trasso segue para a próxima etapa.'
                : 'Descreva o que precisa mudar. Quanto mais específico, mais rápido sai a próxima versão.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`nome-${entrega.id}`}>Seu nome</Label>
              <Input id={`nome-${entrega.id}`} value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`com-${entrega.id}`}>{acao === 'aprovar' ? 'Comentário (opcional)' : 'O que ajustar *'}</Label>
              <Textarea id={`com-${entrega.id}`} rows={acao === 'aprovar' ? 2 : 5} value={comentario} onChange={(e) => setComentario(e.target.value)} />
            </div>
            {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAcao(null)} disabled={pendente}>Cancelar</Button>
            <Button onClick={confirmar} disabled={pendente}>
              {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : acao === 'aprovar' ? 'Confirmar aprovação' : 'Enviar ajustes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

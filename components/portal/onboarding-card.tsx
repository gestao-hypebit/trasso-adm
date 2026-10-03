'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatDate } from '@/lib/utils'
import { marcarItemOnboarding, salvarBriefing } from '@/app/portal/[token]/actions'
import type { Briefing, OnboardingItem } from '@/lib/projetos/onboarding'

export function OnboardingCard({ token, projetoNome, itens, briefing }: {
  token: string
  projetoNome: string
  itens: OnboardingItem[]
  briefing: Briefing | null
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [itemErro, setItemErro] = useState<string | null>(null)

  function alternar(item: OnboardingItem) {
    setItemErro(null)
    startTransition(async () => {
      const r = await marcarItemOnboarding(token, item.id, !item.concluido)
      if (r.success) router.refresh()
      else setItemErro(r.error)
    })
  }

  const ordenados = [...itens].sort((a, b) => a.ordem - b.ordem)
  const feitos = itens.filter((i) => i.concluido).length

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <p className="text-xs text-brand-lavanda/40">Primeiros passos</p>
          <h3 className="text-lg font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{projetoNome}</h3>
          {itens.length > 0 && <p className="text-xs text-brand-lavanda/50 mt-1">{feitos} de {itens.length} itens concluídos</p>}
        </div>

        {ordenados.length > 0 && (
          <div className="space-y-1">
            {ordenados.map((item) => {
              const doCliente = item.responsavel === 'cliente'
              return (
                <div key={item.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => doCliente && alternar(item)}
                    disabled={!doCliente || pendente}
                    className={cn('mt-0.5 shrink-0', doCliente ? 'cursor-pointer' : 'cursor-default')}
                    aria-label={item.concluido ? 'Desmarcar' : 'Marcar como feito'}
                  >
                    {item.concluido ? <CheckCircle2 className="h-5 w-5 text-brand-lima" /> : <Circle className={cn('h-5 w-5', doCliente ? 'text-brand-lavanda/40' : 'text-brand-lavanda/20')} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', item.concluido ? 'text-brand-lavanda/40 line-through' : 'text-brand-lavanda')}>{item.titulo}</p>
                    {item.descricao && !item.concluido && <p className="text-xs text-brand-lavanda/50 mt-0.5">{item.descricao}</p>}
                  </div>
                  <Badge variant={doCliente ? 'pendente' : 'outline'} className="shrink-0">{doCliente ? 'Com você' : 'Com a Trasso'}</Badge>
                </div>
              )
            })}
            {itemErro && <p className="text-xs text-brand-rosa">{itemErro}</p>}
          </div>
        )}

        {briefing && <BriefingForm token={token} briefing={briefing} />}
      </CardContent>
    </Card>
  )
}

function BriefingForm({ token, briefing }: { token: string; briefing: Briefing }) {
  const router = useRouter()
  const [respostas, setRespostas] = useState<Record<string, string>>(briefing.respostas ?? {})
  const [aberto, setAberto] = useState(briefing.status === 'pendente')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [pendente, startTransition] = useTransition()

  function salvar(enviar: boolean) {
    setMsg(null)
    startTransition(async () => {
      const r = await salvarBriefing(token, briefing.id, respostas, enviar)
      if (r.success) {
        setMsg({ tipo: 'ok', texto: enviar ? 'Briefing enviado. Obrigado!' : 'Rascunho salvo. Pode continuar depois.' })
        if (enviar) setAberto(false)
        router.refresh()
      } else {
        setMsg({ tipo: 'erro', texto: r.error })
      }
    })
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-lavanda">Briefing</p>
          <p className="text-xs text-brand-lavanda/50">
            {briefing.status === 'respondido'
              ? `Enviado em ${formatDate(briefing.respondido_em)}. Pode ajustar se quiser.`
              : 'Quanto mais detalhes, melhor sai o projeto. Dá para salvar e continuar depois.'}
          </p>
        </div>
        {!aberto && <Button size="sm" variant="outline" onClick={() => setAberto(true)}>Ver respostas</Button>}
      </div>

      {aberto && (
        <div className="mt-4 space-y-4">
          {briefing.perguntas.map((p) => (
            <div key={p.chave} className="space-y-1.5">
              <Label htmlFor={`b-${p.chave}`}>{p.rotulo}{p.obrigatorio && ' *'}</Label>
              {p.ajuda && <p className="text-xs text-brand-lavanda/40">{p.ajuda}</p>}
              {p.tipo === 'textarea' ? (
                <Textarea id={`b-${p.chave}`} rows={3} value={respostas[p.chave] ?? ''} onChange={(e) => setRespostas((r) => ({ ...r, [p.chave]: e.target.value }))} />
              ) : (
                <Input
                  id={`b-${p.chave}`}
                  type={p.tipo === 'link' ? 'url' : 'text'}
                  placeholder={p.tipo === 'link' ? 'https://' : undefined}
                  value={respostas[p.chave] ?? ''}
                  onChange={(e) => setRespostas((r) => ({ ...r, [p.chave]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => salvar(true)} disabled={pendente}>
              {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : briefing.status === 'respondido' ? 'Salvar alterações' : 'Enviar briefing'}
            </Button>
            {briefing.status === 'pendente' && (
              <Button variant="outline" onClick={() => salvar(false)} disabled={pendente}>Salvar rascunho</Button>
            )}
          </div>
        </div>
      )}
      {msg && <p className={cn('mt-3 text-xs', msg.tipo === 'ok' ? 'text-brand-lima' : 'text-brand-rosa')}>{msg.texto}</p>}
    </div>
  )
}

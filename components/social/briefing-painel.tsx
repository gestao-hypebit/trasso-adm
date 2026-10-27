'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ClipboardList, Copy, ExternalLink, Loader2, MessageCircle, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import {
  ERRO_MIGRATION_BRIEFING, MODELOS_BRIEFING, STATUS_BRIEFING, etapasDoModelo, formatarResposta, linkBriefing, mensagemWhatsappBriefing, textoRespostas,
  type Briefing, type ModeloBriefing,
} from '@/lib/social/briefing'
import { cn, formatDate, whatsappUrl } from '@/lib/utils'

type Cliente = { id: string; nome: string; empresa: string | null; telefone: string | null; whatsapp: string | null }
type Opcao = { id: string; nome: string; empresa: string | null }

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? ''

// Cria o briefing com o modelo escolhido. Sem `clienteId`, pede o cliente também.
export function GerarBriefingDialog({ aberto, onClose, clienteId, clientes, onCriado }: {
  aberto: boolean
  onClose: () => void
  clienteId?: string
  clientes?: Opcao[]
  onCriado: (b: Briefing) => void
}) {
  const [cliente, setCliente] = useState('')
  const [modelo, setModelo] = useState<ModeloBriefing | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (aberto) { setCliente(clienteId ?? ''); setModelo(null); setErro(null) }
  }, [aberto, clienteId])

  async function criar() {
    if (!cliente || !modelo) return
    setSalvando(true)
    setErro(null)
    const { data, error } = await (createClient() as any)
      .from('social_briefings')
      .insert({ cliente_id: cliente, modelo })
      .select('*')
      .single()
    setSalvando(false)
    if (error) { setErro(error.code === '42P01' ? ERRO_MIGRATION_BRIEFING : error.message); return }
    onCriado(data)
    onClose()
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar briefing</DialogTitle>
          <DialogDescription>Gera um link para o cliente responder pelo celular, sem login.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!clienteId && (
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <select
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-brand-lavanda outline-none"
              >
                <option value="" className="bg-brand-noite">Escolha...</option>
                {clientes?.map((c) => <option key={c.id} value={c.id} className="bg-brand-noite">{c.nome}{c.empresa && c.empresa !== c.nome ? ` · ${c.empresa}` : ''}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Modelo *</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.entries(MODELOS_BRIEFING) as [ModeloBriefing, (typeof MODELOS_BRIEFING)[ModeloBriefing]][]).map(([k, m]) => (
                <button key={k} type="button" onClick={() => setModelo(k)}
                  className={cn('rounded-lg border p-3 text-left transition-colors', modelo === k ? 'border-brand-lima/60 bg-brand-lima/[0.06]' : 'border-white/[0.1] hover:border-white/[0.2]')}>
                  <p className={cn('text-sm font-medium', modelo === k ? 'text-brand-lima' : 'text-brand-lavanda')}>{m.label}</p>
                  <p className="mt-0.5 text-xs text-brand-lavanda/50">{m.descricao}</p>
                  <p className="mt-1 text-[11px] text-brand-lavanda/30">{m.perguntas.length} perguntas</p>
                </button>
              ))}
            </div>
          </div>
          {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={criar} disabled={salvando || !cliente || !modelo}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Gerar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Bloco de briefing na página do cliente: o mais recente em destaque, os anteriores no histórico.
export function BriefingPainel({ cliente }: { cliente: Cliente }) {
  const [briefings, setBriefings] = useState<Briefing[] | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [gerar, setGerar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { data, error } = await (createClient() as any)
      .from('social_briefings').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false })
    if (error) setErro(error.code === '42P01' ? ERRO_MIGRATION_BRIEFING : error.message)
    setBriefings(data ?? [])
  }, [cliente.id])

  useEffect(() => { carregar() }, [carregar])

  async function copiar(chave: string, texto: string) {
    await navigator.clipboard.writeText(texto).catch(() => {})
    setCopiado(chave)
    setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 1500)
  }

  const nomeCliente = cliente.empresa || cliente.nome
  const atual = briefings?.find((b) => b.id === selecionado) ?? briefings?.[0]
  const anteriores = briefings?.slice(1) ?? []

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-brand-lima" />
            <h2 className="font-semibold text-brand-lavanda">Briefing</h2>
            {briefings && <Badge variant={STATUS_BRIEFING[briefings[0]?.status ?? 'sem'].variant}>{STATUS_BRIEFING[briefings[0]?.status ?? 'sem'].label}</Badge>}
          </div>
          <Button size="sm" variant={atual ? 'outline' : 'default'} onClick={() => setGerar(true)}>
            <Plus className="h-3.5 w-3.5" /> {atual ? 'Gerar novo briefing' : 'Gerar briefing'}
          </Button>
        </div>

        {erro && <p className="text-sm text-brand-rosa">{erro}</p>}

        {!briefings ? (
          <p className="py-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-brand-lavanda/40" /></p>
        ) : !atual ? (
          !erro && <p className="py-6 text-center text-sm text-brand-lavanda/50">Nenhum briefing ainda. Gere um link e mande para o cliente pelo WhatsApp.</p>
        ) : (
          <BriefingDetalhe
            briefing={atual}
            maisRecente={atual.id === briefings[0].id}
            nomeCliente={nomeCliente}
            contato={primeiroNome(cliente.nome)}
            telefone={cliente.whatsapp ?? cliente.telefone}
            copiado={copiado}
            copiar={copiar}
          />
        )}

        {anteriores.length > 0 && (
          <div className="space-y-1 border-t border-white/[0.06] pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-lavanda/40">Histórico</p>
            {briefings!.map((b) => (
              <button key={b.id} type="button" onClick={() => setSelecionado(b.id)}
                className={cn('flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.04]', atual?.id === b.id && 'bg-white/[0.06]')}>
                <span className="text-brand-lavanda/70">{formatDate(b.created_at)} · {MODELOS_BRIEFING[b.modelo]?.label ?? b.modelo}{b.id === briefings![0].id && ' · mais recente'}</span>
                <Badge variant={STATUS_BRIEFING[b.status].variant}>{b.status === 'respondido' ? 'Respondido' : 'Pendente'}</Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <GerarBriefingDialog aberto={gerar} onClose={() => setGerar(false)} clienteId={cliente.id}
        onCriado={(b) => { setSelecionado(b.id); carregar() }} />
    </Card>
  )
}

function BriefingDetalhe({ briefing: b, maisRecente, nomeCliente, contato, telefone, copiado, copiar }: {
  briefing: Briefing
  maisRecente: boolean
  nomeCliente: string
  contato: string
  telefone: string | null
  copiado: string | null
  copiar: (chave: string, texto: string) => void
}) {
  const link = linkBriefing(b.token)
  const mensagem = mensagemWhatsappBriefing(contato, link)
  const wa = whatsappUrl(telefone, mensagem)
  const modelo = MODELOS_BRIEFING[b.modelo]
  const Icone = (chave: string) => (copiado === chave ? <Check className="h-3.5 w-3.5 text-brand-lima" /> : <Copy className="h-3.5 w-3.5" />)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-lavanda/50">
        <span className="font-medium text-brand-lavanda/80">{modelo?.label ?? b.modelo}</span>
        <span>Gerado em {formatDate(b.created_at)}</span>
        {b.respondido_em
          ? <span className="text-brand-lima">Respondido em {formatDate(b.respondido_em, "dd/MM/yyyy 'às' HH:mm")}</span>
          : <span className="text-yellow-400">Aguardando resposta</span>}
        {!maisRecente && <Badge variant="outline">Briefing anterior</Badge>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => copiar('link', link)}>{Icone('link')} Copiar link</Button>
        <Button size="sm" variant="outline" onClick={() => copiar('mensagem', mensagem)}>{Icone('mensagem')} Copiar mensagem para WhatsApp</Button>
        {wa && b.status === 'enviado' && (
          <Button size="sm" variant="ghost" asChild><a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp</a></Button>
        )}
        <Button size="sm" variant="ghost" asChild><a href={`/briefing/${b.token}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ver</a></Button>
        {b.status === 'respondido' && (
          <Button size="sm" className="sm:ml-auto" onClick={() => copiar('respostas', textoRespostas(nomeCliente, b))}>{Icone('respostas')} Copiar respostas</Button>
        )}
      </div>

      {b.status === 'respondido' && modelo && (
        <div className="grid gap-4 lg:grid-cols-2">
          {etapasDoModelo(b.modelo).map((etapa, i) => (
            <section key={etapa.titulo} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-lavanda">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-lima/15 text-[11px] text-brand-lima">{i + 1}</span>
                {etapa.titulo}
              </h3>
              <dl className="space-y-2.5">
                {etapa.perguntas.map((q) => {
                  const v = formatarResposta(b.respostas[q.chave])
                  return (
                    <div key={q.chave}>
                      <dt className="text-[11px] text-brand-lavanda/40">{q.rotulo}</dt>
                      <dd className={cn('whitespace-pre-wrap text-sm', v === '—' ? 'text-brand-lavanda/25' : 'text-brand-lavanda/90')}>{v}</dd>
                    </div>
                  )
                })}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

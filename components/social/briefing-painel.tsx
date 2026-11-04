'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ClipboardList, Copy, ExternalLink, ListChecks, Loader2, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { EditorPerguntasDialog, perguntasPadrao } from '@/components/social/editor-perguntas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import {
  ERRO_MIGRATION_BRIEFING, ERRO_MIGRATION_BRIEFING_EMPRESA, ERRO_MIGRATION_BRIEFING_SITE, MODELOS_BRIEFING, STATUS_BRIEFING, etapasDoModelo, formatarResposta, linkBriefing,
  mensagemWhatsappBriefing, modelosDaArea, perguntasDoBriefing, textoRespostas,
  type AreaBriefing, type Briefing, type ModeloBriefing,
} from '@/lib/social/briefing'
import { cn, formatDate, whatsappUrl } from '@/lib/utils'

type Cliente = { id: string; nome: string; empresa: string | null; telefone: string | null; whatsapp: string | null }
type Opcao = { id: string; nome: string; empresa: string | null }

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? ''

// Tabela inexistente, coluna projeto_id inexistente ou modelo 'site' barrado pelo check: falta migration.
function mensagemErro(error: { code?: string; message: string }, area: AreaBriefing) {
  if (error.code === '42P01') return ERRO_MIGRATION_BRIEFING
  if (area === 'site' && ['42703', 'PGRST204', '23514'].includes(error.code ?? '')) return ERRO_MIGRATION_BRIEFING_SITE
  if (error.code === '23514') return ERRO_MIGRATION_BRIEFING_EMPRESA
  return error.message
}

// Cria o briefing com o modelo escolhido. Sem `clienteId`, pede o cliente também.
// Com `projetoId`, o briefing fica ligado ao projeto (briefing de site).
export function GerarBriefingDialog({ aberto, onClose, clienteId, clientes, onCriado, area = 'social', projetoId }: {
  aberto: boolean
  onClose: () => void
  clienteId?: string
  clientes?: Opcao[]
  onCriado: (b: Briefing) => void
  area?: AreaBriefing
  projetoId?: string
}) {
  const modelos = modelosDaArea(area)
  const [cliente, setCliente] = useState('')
  const [modelo, setModelo] = useState<ModeloBriefing | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (aberto) { setCliente(clienteId ?? ''); setModelo(modelos.length === 1 ? modelos[0] : null); setErro(null) }
  }, [aberto, clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function criar() {
    if (!cliente || !modelo) return
    setSalvando(true)
    setErro(null)
    const db = createClient() as any
    const base = { cliente_id: cliente, modelo, ...(projetoId ? { projeto_id: projetoId } : {}) }
    // O briefing nasce com uma cópia das perguntas padrão, que dá para ajustar só para este cliente.
    const perguntas = await perguntasPadrao(db, modelo)
    let { data, error } = await db.from('social_briefings').insert({ ...base, perguntas }).select('*').single()
    // Sem a migration das perguntas editáveis: gera do jeito antigo (perguntas do código).
    if (error && ['42703', 'PGRST204'].includes(error.code)) {
      ({ data, error } = await db.from('social_briefings').insert(base).select('*').single())
    }
    setSalvando(false)
    if (error) { setErro(mensagemErro(error, area)); return }
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
              {modelos.map((k) => [k, MODELOS_BRIEFING[k]] as const).map(([k, m]) => (
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

// Bloco de briefing: o mais recente em destaque, os anteriores no histórico.
// Social: briefings do cliente. Site: briefings do projeto.
export function BriefingPainel({ cliente, area = 'social', projetoId }: { cliente: Cliente; area?: AreaBriefing; projetoId?: string }) {
  const [briefings, setBriefings] = useState<Briefing[] | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [gerar, setGerar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)

  const carregar = useCallback(async () => {
    const base = (createClient() as any).from('social_briefings').select('*')
    const filtrada = projetoId ? base.eq('projeto_id', projetoId) : base.eq('cliente_id', cliente.id).in('modelo', modelosDaArea(area))
    const { data, error } = await filtrada.order('created_at', { ascending: false })
    if (error) setErro(mensagemErro(error, area))
    setBriefings(data ?? [])
  }, [cliente.id, area, projetoId])

  useEffect(() => { carregar() }, [carregar])

  async function copiar(chave: string, texto: string) {
    await navigator.clipboard.writeText(texto).catch(() => {})
    setCopiado(chave)
    setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 1500)
  }

  async function excluir(b: Briefing) {
    const aviso = b.status === 'respondido'
      ? 'Excluir este briefing? As respostas do cliente serão apagadas e não dá para desfazer.'
      : 'Excluir este briefing? O link enviado para o cliente vai parar de funcionar e não dá para desfazer.'
    if (!window.confirm(aviso)) return
    setErro(null)
    const { error } = await (createClient() as any).from('social_briefings').delete().eq('id', b.id)
    if (error) { setErro(error.message); return }
    setSelecionado(null)
    carregar()
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
            <h2 className="font-semibold text-brand-lavanda">{area === 'site' ? 'Briefing do site' : 'Briefing'}</h2>
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
            onEditar={() => setEditando(true)}
            onExcluir={area === 'social' ? () => excluir(atual) : undefined}
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

      <GerarBriefingDialog aberto={gerar} onClose={() => setGerar(false)} clienteId={cliente.id} area={area} projetoId={projetoId}
        onCriado={(b) => { setSelecionado(b.id); carregar() }} />
      {atual && (
        <EditorPerguntasDialog aberto={editando} onClose={() => setEditando(false)} briefing={atual} nomeCliente={nomeCliente} onSalvo={carregar} />
      )}
    </Card>
  )
}

function BriefingDetalhe({ briefing: b, maisRecente, nomeCliente, contato, telefone, copiado, copiar, onEditar, onExcluir }: {
  briefing: Briefing
  maisRecente: boolean
  nomeCliente: string
  contato: string
  telefone: string | null
  copiado: string | null
  copiar: (chave: string, texto: string) => void
  onEditar: () => void
  onExcluir?: () => void
}) {
  const perguntas = perguntasDoBriefing(b)
  const link = linkBriefing(b.token)
  const mensagem = mensagemWhatsappBriefing(contato, link, b.modelo)
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
        <span>{perguntas.length} perguntas</span>
        {!maisRecente && <Badge variant="outline">Briefing anterior</Badge>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => copiar('link', link)}>{Icone('link')} Copiar link</Button>
        <Button size="sm" variant="outline" onClick={() => copiar('mensagem', mensagem)}>{Icone('mensagem')} Copiar mensagem para WhatsApp</Button>
        {wa && b.status === 'enviado' && (
          <Button size="sm" variant="ghost" asChild><a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp</a></Button>
        )}
        <Button size="sm" variant="ghost" asChild><a href={`/briefing/${b.token}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ver</a></Button>
        {b.status === 'enviado' && (
          <Button size="sm" variant="ghost" onClick={onEditar}><ListChecks className="h-3.5 w-3.5" /> Editar perguntas</Button>
        )}
        {onExcluir && (
          <Button size="sm" variant="ghost" className="hover:text-brand-rosa" onClick={onExcluir}><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
        )}
        {b.status === 'respondido' && (
          <Button size="sm" className="sm:ml-auto" onClick={() => copiar('respostas', textoRespostas(nomeCliente, b))}>{Icone('respostas')} Copiar respostas</Button>
        )}
      </div>

      {b.status === 'respondido' && modelo && (
        <div className="grid gap-4 lg:grid-cols-2">
          {etapasDoModelo(perguntas).map((etapa, i) => (
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

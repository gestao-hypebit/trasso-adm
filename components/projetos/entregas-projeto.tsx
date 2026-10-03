'use client'

import { useEffect, useState } from 'react'
import { Plus, Loader2, ExternalLink, PackageCheck, RotateCcw, Trash2, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { PortalLinkAcoes, type ClientePortal } from '@/components/projetos/portal-link-acoes'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import {
  ENTREGA_SELECT, ajustesPedidos, entregaStatusConfig, entregaTipoOpcoes, eventoLabel, labelEntregaTipo, ordenarEventos,
  type Entrega,
} from '@/lib/projetos/entregas'

type Avaliacao = { id: string; status: string; nota: number | null; comentario: string | null; respondida_em: string | null }

const FORM_VAZIO = { titulo: '', tipo: 'layout', link: '', descricao: '' }

export function EntregasProjeto({ projetoId, clienteId, cliente, revisoesInclusas, onRevisoesChange }: {
  projetoId: string
  clienteId: string | null
  cliente: ClientePortal | null
  revisoesInclusas: number | null
  onRevisoesChange: (n: number | null) => void
}) {
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // null = fechado; 'nova' = nova entrega; id = nova versão daquela entrega
  const [dialogo, setDialogo] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [revisoes, setRevisoes] = useState(revisoesInclusas != null ? String(revisoesInclusas) : '')

  async function carregar() {
    const supabase = createClient() as any
    const [{ data, error }, { data: av }] = await Promise.all([
      supabase.from('entregas').select(ENTREGA_SELECT).eq('projeto_id', projetoId).order('created_at', { ascending: false }),
      supabase.from('avaliacoes').select('id, status, nota, comentario, respondida_em').eq('projeto_id', projetoId).maybeSingle(),
    ])
    if (error) setErro('Não foi possível carregar. A migration de entregas já foi aplicada no Supabase?')
    setEntregas((data as Entrega[]) ?? [])
    setAvaliacao(av as Avaliacao | null)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [projetoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const versaoDe = dialogo && dialogo !== 'nova' ? entregas.find((e) => e.id === dialogo) ?? null : null

  function abrirNova() {
    setForm(FORM_VAZIO)
    setDialogo('nova')
  }

  function abrirNovaVersao(e: Entrega) {
    setForm({ titulo: e.titulo, tipo: e.tipo, link: e.link ?? '', descricao: '' })
    setDialogo(e.id)
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    const supabase = createClient() as any
    const agora = new Date().toISOString()
    const link = form.link.trim() || null
    const descricao = form.descricao.trim() || null
    try {
      if (versaoDe) {
        const rodada = versaoDe.rodada + 1
        const { error } = await supabase.from('entregas')
          .update({ status: 'aguardando', rodada, link: link ?? versaoDe.link, descricao: descricao ?? versaoDe.descricao, enviada_em: agora, updated_at: agora })
          .eq('id', versaoDe.id)
        if (error) throw error
        await supabase.from('entrega_eventos').insert({ entrega_id: versaoDe.id, tipo: 'enviada', rodada, autor: 'agencia', comentario: descricao, link })
      } else {
        if (!form.titulo.trim()) return
        const { data, error } = await supabase.from('entregas')
          .insert({ projeto_id: projetoId, titulo: form.titulo.trim(), tipo: form.tipo, link, descricao })
          .select('id')
          .single()
        if (error) throw error
        await supabase.from('entrega_eventos').insert({ entrega_id: data.id, tipo: 'enviada', rodada: 1, autor: 'agencia', comentario: descricao, link })
      }
      setDialogo(null)
      await carregar()
    } catch {
      setErro('Não foi possível salvar a entrega.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    setEntregas((prev) => prev.filter((e) => e.id !== id))
    await (createClient() as any).from('entregas').delete().eq('id', id)
  }

  async function salvarRevisoes() {
    const n = revisoes === '' ? null : Math.max(0, Math.floor(Number(revisoes)))
    if (n === revisoesInclusas) return
    const { error } = await (createClient() as any).from('projetos').update({ revisoes_inclusas: n }).eq('id', projetoId)
    if (!error) onRevisoesChange(n)
  }

  async function pedirAvaliacao() {
    if (!clienteId) return
    const { data, error } = await (createClient() as any)
      .from('avaliacoes')
      .insert({ cliente_id: clienteId, projeto_id: projetoId })
      .select('id, status, nota, comentario, respondida_em')
      .single()
    if (error) setErro('Não foi possível criar o pedido de avaliação.')
    else setAvaliacao(data as Avaliacao)
  }

  if (loading) return <p className="py-10 text-center text-sm text-brand-lavanda/40">Carregando...</p>

  const ajustes = ajustesPedidos(entregas)
  const excedeu = revisoesInclusas != null && ajustes > revisoesInclusas
  const pendentes = entregas.filter((e) => e.status === 'aguardando').length

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs text-brand-lavanda/50">Ajustes pedidos</p>
              <p className={cn('text-xl font-bold', excedeu ? 'text-brand-rosa' : 'text-brand-lavanda')}>
                {ajustes}{revisoesInclusas != null && <span className="text-sm font-normal text-brand-lavanda/40"> de {revisoesInclusas} incluídos</span>}
              </p>
              {excedeu && <p className="text-[11px] text-brand-rosa">Passou do contratado: dá para cobrar as rodadas extras.</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="revisoes" className="text-xs text-brand-lavanda/50">Rodadas de ajuste incluídas</Label>
              <Input id="revisoes" type="number" min="0" className="w-28" placeholder="Sem limite" value={revisoes} onChange={(e) => setRevisoes(e.target.value)} onBlur={salvarRevisoes} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendentes > 0 && <PortalLinkAcoes cliente={cliente} mensagem="Tem entrega nova esperando sua aprovação no portal:" />}
            <Button size="sm" onClick={abrirNova}><Plus className="h-3.5 w-3.5" /> Nova entrega</Button>
          </div>
        </CardContent>
      </Card>

      {erro && <p className="text-xs text-brand-rosa">{erro}</p>}

      {entregas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PackageCheck className="h-10 w-10 text-brand-lavanda/20 mx-auto mb-3" />
            <p className="text-sm text-brand-lavanda/70">Nenhuma entrega enviada.</p>
            <p className="text-xs text-brand-lavanda/40 mt-1">Envie layouts e versões de teste para o cliente aprovar pelo portal. Tudo fica registrado com data.</p>
          </CardContent>
        </Card>
      ) : entregas.map((e) => {
        const sc = entregaStatusConfig[e.status]
        return (
          <Card key={e.id}>
            <CardContent className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                    <span className="text-xs text-brand-lavanda/40">{labelEntregaTipo(e.tipo)} · versão {e.rodada}</span>
                  </div>
                  <h3 className="font-semibold text-brand-lavanda">{e.titulo}</h3>
                  {e.link && (
                    <a href={e.link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-lima hover:underline break-all">
                      <ExternalLink className="h-3 w-3 shrink-0" /> {e.link}
                    </a>
                  )}
                  {e.status === 'aprovada' && (
                    <p className="mt-1 text-xs text-brand-lima">Aprovada por {e.aprovada_nome} em {formatDate(e.aprovada_em, "dd/MM/yyyy 'às' HH:mm")}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {e.status === 'ajustes' && (
                    <Button size="sm" variant="violeta" onClick={() => abrirNovaVersao(e)}><RotateCcw className="h-3.5 w-3.5" /> Enviar nova versão</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => excluir(e.id)} className="text-brand-lavanda/30 hover:text-brand-rosa" aria-label="Excluir entrega">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <ol className="mt-4 space-y-2 border-l border-white/[0.08] pl-4">
                {ordenarEventos(e.entrega_eventos).map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className={cn(
                      'absolute -left-[21px] top-1.5 h-2 w-2 rounded-full',
                      ev.tipo === 'aprovada' ? 'bg-brand-lima' : ev.tipo === 'ajustes' ? 'bg-brand-rosa' : 'bg-brand-violeta'
                    )} />
                    <p className="text-xs text-brand-lavanda/70">
                      <span className="font-medium text-brand-lavanda">{eventoLabel[ev.tipo]}</span>
                      {' · '}v{ev.rodada}
                      {ev.autor === 'cliente' && ev.nome && <> · {ev.nome}</>}
                      {' · '}{formatDate(ev.created_at, "dd/MM 'às' HH:mm")}
                    </p>
                    {ev.comentario && <p className="mt-0.5 whitespace-pre-wrap text-sm text-brand-lavanda/80">{ev.comentario}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )
      })}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-brand-lima" /> Avaliação do cliente</CardTitle></CardHeader>
        <CardContent>
          {!avaliacao ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-brand-lavanda/50">O pedido é criado sozinho quando o projeto vira &quot;Concluído&quot;. Também dá para pedir agora.</p>
              <Button size="sm" variant="outline" onClick={pedirAvaliacao} disabled={!clienteId}>Pedir avaliação</Button>
            </div>
          ) : avaliacao.status === 'respondida' ? (
            <div>
              <p className="text-sm text-brand-lavanda">Nota <span className="text-xl font-bold text-brand-lima">{avaliacao.nota}</span> em {formatDate(avaliacao.respondida_em)}</p>
              {avaliacao.comentario && <p className="mt-1 text-sm text-brand-lavanda/70 whitespace-pre-wrap">{avaliacao.comentario}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-brand-lavanda/50">Aguardando o cliente responder no portal.</p>
              <PortalLinkAcoes cliente={cliente} mensagem="Seu projeto foi concluído! Pode avaliar nosso trabalho? Leva 1 minuto:" />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialogo} onOpenChange={(open) => !open && setDialogo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{versaoDe ? `Nova versão — ${versaoDe.titulo}` : 'Nova entrega'}</DialogTitle>
            <DialogDescription>O cliente vê no portal e aprova ou pede ajustes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {!versaoDe && (
              <div className="grid grid-cols-[1fr_150px] gap-3">
                <div className="space-y-1.5">
                  <Label>Título *</Label>
                  <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Layout da página inicial" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(tipo) => setForm({ ...form, tipo })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {entregaTipoOpcoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Link para o cliente ver</Label>
              <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Figma, site de teste, Drive…" />
            </div>
            <div className="space-y-1.5">
              <Label>{versaoDe ? 'O que mudou nesta versão' : 'Mensagem para o cliente'}</Label>
              <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogo(null)} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando || (!versaoDe && !form.titulo.trim())}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar para o cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

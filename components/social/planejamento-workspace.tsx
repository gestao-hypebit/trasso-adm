'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CalendarDays, Check, Copy, ExternalLink, Eye, List, Loader2, Mail, MessageCircle, Pencil, Plus, Send, Trash2, Wand2,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarioMes, LegendaFormatos } from '@/components/social/calendario-mes'
import { PostCard } from '@/components/social/post-card'
import { PostDialog } from '@/components/social/post-dialog'
import { SugerirDialog } from '@/components/social/sugerir-dialog'
import { PdfBotao } from '@/components/social/pdf-botao'
import { createClient } from '@/lib/supabase/client'
import { ERRO_MIGRATION, ERRO_MIGRATION_PERIODO, PRODUCAO, STATUS_PLANEJAMENTO, fimDoPeriodo, nomePeriodo, ordenarPosts, statusPelosPosts, type Planejamento, type Post } from '@/lib/social/tipos'
import { cn, formatDate, whatsappUrl } from '@/lib/utils'

type Dados = Planejamento & {
  clientes: { nome: string; empresa: string | null; email: string | null; telefone: string | null; whatsapp: string | null } | null
}

export function PlanejamentoWorkspace({ id }: { id: string }) {
  const router = useRouter()
  const [plano, setPlano] = useState<Dados | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [agencia, setAgencia] = useState<{ nome: string; logo_url: string | null }>({ nome: 'Slick', logo_url: null })
  const [erro, setErro] = useState<string | null>(null)
  const [visao, setVisao] = useState<'calendario' | 'lista'>('calendario')
  const [editando, setEditando] = useState<{ post: Post | null; data: string | null } | null>(null)
  const [sugerir, setSugerir] = useState(false)
  const [enviar, setEnviar] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [textos, setTextos] = useState<{ objetivo: string; observacoes: string; inicio: string; fim: string } | null>(null)
  const [salvandoTextos, setSalvandoTextos] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const carregar = useCallback(async () => {
    const db = createClient() as any
    const [{ data: p, error }, { data: lista }] = await Promise.all([
      db.from('social_planejamentos').select('*, clientes(nome, empresa, email, telefone, whatsapp)').eq('id', id).maybeSingle(),
      db.from('social_posts').select('*').eq('planejamento_id', id),
    ])
    if (error) { setErro(error.code === '42P01' ? ERRO_MIGRATION : error.message); return }
    if (!p) { setErro('Planejamento não encontrado.'); return }
    const ps = ordenarPosts(lista ?? [])
    // Editar um post respondido o devolve para "aguardando": o status do planejamento acompanha.
    const status = statusPelosPosts(ps, p.status)
    if (status !== p.status) {
      await db.from('social_planejamentos').update({ status, aprovado_em: status === 'aprovado' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id)
      p.status = status
    }
    setPlano(p)
    setPosts(ps)
    setTextos((t) => t ?? { objetivo: p.objetivo ?? '', observacoes: p.observacoes ?? '', inicio: p.mes, fim: fimDoPeriodo(p.mes, p.data_fim) })
  }, [id])

  useEffect(() => {
    carregar()
    ;(createClient() as any).from('configuracoes_agencia').select('nome, logo_url').limit(1).maybeSingle()
      .then(({ data }: { data: { nome: string; logo_url: string | null } | null }) => data && setAgencia(data))
  }, [carregar])

  if (!plano) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-brand-lavanda/40">{erro ?? <Loader2 className="h-5 w-5 animate-spin" />}</div>
  }

  const nomeCliente = plano.clientes?.empresa || plano.clientes?.nome || 'Cliente'
  const periodo = nomePeriodo(plano.mes, plano.data_fim)
  const link = typeof window !== 'undefined' ? `${window.location.origin}/plano/${plano.token}` : `/plano/${plano.token}`
  const st = STATUS_PLANEJAMENTO[plano.status] ?? STATUS_PLANEJAMENTO.rascunho
  const telefone = plano.clientes?.whatsapp ?? plano.clientes?.telefone
  const aprovados = posts.filter((p) => p.aprovacao === 'aprovado').length
  const ajustes = posts.filter((p) => p.aprovacao === 'ajustes')
  const textoPadrao = `Olá, ${plano.clientes?.nome?.split(' ')[0] ?? ''}! O planejamento de conteúdo (${periodo}) está pronto 🎉\n\nSão ${posts.length} posts. Dá uma olhada e aprove (ou peça ajuste) em cada um por aqui:\n${link}`
  const periodoMudou = textos && (textos.inicio !== plano.mes || textos.fim !== fimDoPeriodo(plano.mes, plano.data_fim))
  const sujoTextos = textos && (periodoMudou || textos.objetivo !== (plano.objetivo ?? '') || textos.observacoes !== (plano.observacoes ?? ''))
  const foraDoPeriodo = textos ? posts.filter((p) => p.data < textos.inicio || p.data > textos.fim).length : 0

  async function marcarEnviado() {
    if (!plano || plano.status !== 'rascunho') return
    await (createClient() as any).from('social_planejamentos')
      .update({ status: statusPelosPosts(posts, 'enviado'), enviado_em: new Date().toISOString(), link_ativo: true, updated_at: new Date().toISOString() })
      .eq('id', id)
    await carregar()
  }

  async function copiar(texto: string) {
    await navigator.clipboard.writeText(texto).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  async function salvarTextos() {
    if (!textos || !plano) return
    if (!textos.inicio || !textos.fim || textos.fim < textos.inicio) { setErro('O fim do período tem que ser depois do início.'); return }
    setSalvandoTextos(true)
    setErro(null)
    const { error } = await (createClient() as any).from('social_planejamentos')
      .update({
        objetivo: textos.objetivo.trim() || null,
        observacoes: textos.observacoes.trim() || null,
        ...(periodoMudou && { mes: textos.inicio, data_fim: textos.fim, titulo: `${nomeCliente} · ${nomePeriodo(textos.inicio, textos.fim)}` }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    setSalvandoTextos(false)
    if (error) { setErro(error.message.includes('data_fim') ? ERRO_MIGRATION_PERIODO : error.message); return }
    setTextos(null)
    await carregar()
  }

  async function alternarLink() {
    if (!plano) return
    await (createClient() as any).from('social_planejamentos').update({ link_ativo: !plano.link_ativo }).eq('id', id)
    await carregar()
  }

  async function voltarRascunho() {
    await (createClient() as any).from('social_planejamentos').update({ status: 'rascunho', updated_at: new Date().toISOString() }).eq('id', id)
    await carregar()
  }

  async function excluir() {
    const { error } = await (createClient() as any).from('social_planejamentos').delete().eq('id', id)
    if (error) { setErro(error.message); return }
    router.push('/social')
  }

  const wa = whatsappUrl(telefone, mensagem)
  const mailto = plano.clientes?.email
    ? `mailto:${plano.clientes.email}?subject=${encodeURIComponent(`Planejamento de conteúdo · ${periodo}`)}&body=${encodeURIComponent(mensagem)}`
    : null

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Social media" description={`${nomeCliente} · ${periodo}`} />

      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3 md:px-6">
        <Link href="/social" className="mr-1 rounded-md p-1 text-brand-lavanda/40 hover:bg-white/[0.06] hover:text-brand-lavanda" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
        <h1 className="mr-1 truncate text-base font-semibold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{nomeCliente}</h1>
        <span className="text-sm text-brand-lavanda/50">{periodo}</span>
        <Badge variant={st.variant}>{st.label}</Badge>
        {plano.status !== 'rascunho' && (
          <span className="flex items-center gap-1 text-xs text-brand-lavanda/40" title={plano.ultima_visualizacao ? `Última vez: ${formatDate(plano.ultima_visualizacao, 'dd/MM/yyyy HH:mm')}` : 'Ainda não abriram o link'}>
            <Eye className="h-3.5 w-3.5" /> {plano.visualizacoes}
            {plano.ultima_visualizacao && <> · última {formatDate(plano.ultima_visualizacao, 'dd/MM HH:mm')}</>}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setSugerir(true)}><Wand2 className="h-3.5 w-3.5" /> Sugerir pauta</Button>
          <Button size="sm" variant="outline" onClick={() => setEditando({ post: null, data: plano.mes })}><Plus className="h-3.5 w-3.5" /> Post</Button>
          <PdfBotao cliente={nomeCliente} mes={plano.mes} fim={plano.data_fim} objetivo={plano.objetivo} posts={posts} logoUrl={agencia.logo_url} agenciaNome={agencia.nome} comAprovacao={plano.status !== 'rascunho'} />
          <Button size="sm" onClick={() => { setMensagem(textoPadrao); setEnviar(true) }} disabled={!posts.length}>
            <Send className="h-3.5 w-3.5" /> {plano.status === 'rascunho' ? 'Enviar para o cliente' : 'Reenviar'}
          </Button>
        </div>
      </div>

      <main className="grid flex-1 gap-5 p-4 md:p-6 xl:grid-cols-[1fr_300px]">
        <section className="min-w-0 space-y-4">
          {erro && <p className="text-sm text-brand-rosa">{erro}</p>}

          {ajustes.length > 0 && (
            <div className="rounded-xl border border-brand-rosa/25 bg-brand-rosa/[0.05] p-4">
              <p className="mb-2 text-sm font-medium text-brand-rosa">O cliente pediu ajuste em {ajustes.length} post{ajustes.length > 1 ? 's' : ''}</p>
              <ul className="space-y-1.5">
                {ajustes.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setEditando({ post: p, data: null })} className="text-left text-sm text-brand-lavanda/80 hover:text-brand-lavanda">
                      <span className="text-brand-lavanda/40">{formatDate(p.data, 'dd/MM')} · </span>
                      <span className="font-medium">{p.titulo}</span>
                      {p.comentario_cliente && <span className="text-brand-lavanda/60">: “{p.comentario_cliente}”</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-brand-lavanda/40">Ao editar o post, ele volta a aguardar aprovação no mesmo link.</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg border border-white/[0.06] p-0.5">
              {([['calendario', CalendarDays, 'Calendário'], ['lista', List, 'Lista']] as const).map(([v, Icone, label]) => (
                <button key={v} type="button" onClick={() => setVisao(v)}
                  className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', visao === v ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50 hover:text-brand-lavanda')}>
                  <Icone className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <LegendaFormatos />
          </div>

          {visao === 'calendario' ? (
            <CalendarioMes mes={plano.mes} fim={plano.data_fim} posts={posts} onPost={(p) => setEditando({ post: p, data: null })} onNovo={(data) => setEditando({ post: null, data })} mostrarAprovacao={plano.status !== 'rascunho'} />
          ) : posts.length === 0 ? (
            <Card><CardContent className="py-14 text-center text-sm text-brand-lavanda/40">Nenhum post ainda. Crie um ou peça uma pauta para a IA.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} interno acoes={
                  <Button size="sm" variant="outline" onClick={() => setEditando({ post: p, data: null })}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                } />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-lavanda/40">Resumo</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Numero n={posts.length} label="posts" />
                <Numero n={aprovados} label="aprovados" cor="text-brand-lima" />
                <Numero n={ajustes.length} label="ajustes" cor={ajustes.length ? 'text-brand-rosa' : undefined} />
              </div>
              <div className="space-y-1 border-t border-white/[0.06] pt-3">
                {Object.entries(PRODUCAO).map(([k, v]) => {
                  const n = posts.filter((p) => p.producao === k).length
                  return (
                    <div key={k} className="flex items-center justify-between text-xs">
                      <span className="text-brand-lavanda/50">{v.label}</span>
                      <span className={n ? 'font-medium text-brand-lavanda' : 'text-brand-lavanda/30'}>{n}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {textos && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Período</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" aria-label="Início" value={textos.inicio} onChange={(e) => setTextos({ ...textos, inicio: e.target.value })} />
                    <Input type="date" aria-label="Fim" value={textos.fim} min={textos.inicio || undefined} onChange={(e) => setTextos({ ...textos, fim: e.target.value })} />
                  </div>
                  {periodoMudou && foraDoPeriodo > 0 && (
                    <p className="text-xs text-brand-rosa">{foraDoPeriodo} post{foraDoPeriodo > 1 ? 's ficam' : ' fica'} fora do novo período (some{foraDoPeriodo > 1 ? 'm' : ''} do calendário, mas continua{foraDoPeriodo > 1 ? 'm' : ''} na lista).</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Objetivo do mês <span className="text-brand-lavanda/30">(o cliente vê)</span></Label>
                  <Textarea rows={3} value={textos.objetivo} onChange={(e) => setTextos({ ...textos, objetivo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Anotações internas</Label>
                  <Textarea rows={4} value={textos.observacoes} onChange={(e) => setTextos({ ...textos, observacoes: e.target.value })} placeholder="Acessos, referências, combinados…" />
                </div>
                {sujoTextos && <Button size="sm" className="w-full" onClick={salvarTextos} disabled={salvandoTextos}>{salvandoTextos && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar</Button>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-3 p-4 text-xs text-brand-lavanda/50">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-lavanda/40">Link do cliente</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => copiar(link)}>
                  {copiado ? <Check className="h-3.5 w-3.5 text-brand-lima" /> : <Copy className="h-3.5 w-3.5" />} Copiar
                </Button>
                <Button size="sm" variant="outline" asChild><a href={`/plano/${plano.token}?admin=1`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ver</a></Button>
              </div>
              {plano.enviado_em && <p>Enviado em {formatDate(plano.enviado_em, "dd/MM 'às' HH:mm")}</p>}
              {plano.aprovado_em && plano.status === 'aprovado' && <p className="text-brand-lima">Aprovado em {formatDate(plano.aprovado_em, "dd/MM 'às' HH:mm")}</p>}
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-[#B8F000]" checked={plano.link_ativo} onChange={alternarLink} /> Link ativo
              </label>
              {plano.status !== 'rascunho' && (
                <button type="button" onClick={voltarRascunho} className="block hover:text-brand-lavanda">Voltar para rascunho</button>
              )}
              <div className="border-t border-white/[0.06] pt-3">
                {confirmarExclusao ? (
                  <span className="flex items-center gap-2">
                    Excluir planejamento e posts?
                    <button type="button" onClick={excluir} className="font-medium text-brand-rosa">Excluir</button>
                    <button type="button" onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmarExclusao(true)} className="flex items-center gap-1 hover:text-brand-rosa"><Trash2 className="h-3.5 w-3.5" /> Excluir planejamento</button>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>

      <PostDialog
        aberto={!!editando}
        onClose={() => setEditando(null)}
        planejamentoId={id}
        post={editando?.post ?? null}
        data={editando?.data ?? null}
        mes={plano.mes}
        fim={plano.data_fim}
        onSalvo={carregar}
      />
      <SugerirDialog aberto={sugerir} onClose={() => setSugerir(false)} planejamentoId={id} onAdicionados={carregar} />

      <Dialog open={enviar} onOpenChange={setEnviar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para o cliente</DialogTitle>
            <DialogDescription>O cliente abre o link, vê o calendário e aprova ou pede ajuste em cada post. Você é avisado no sino.</DialogDescription>
          </DialogHeader>
          <Textarea rows={7} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => { copiar(mensagem); marcarEnviado() }}>
              {copiado ? <Check className="h-4 w-4 text-brand-lima" /> : <Copy className="h-4 w-4" />} Copiar mensagem
            </Button>
            {mailto && <Button variant="outline" asChild><a href={mailto} onClick={marcarEnviado}><Mail className="h-4 w-4" /> E-mail</a></Button>}
            {wa
              ? <Button asChild><a href={wa} target="_blank" rel="noreferrer" onClick={marcarEnviado}><MessageCircle className="h-4 w-4" /> WhatsApp</a></Button>
              : <Button disabled title="Cliente sem telefone cadastrado"><MessageCircle className="h-4 w-4" /> WhatsApp</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Numero({ n, label, cor }: { n: number; label: string; cor?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] py-2">
      <p className={cn('text-lg font-bold text-brand-lavanda', cor)}>{n}</p>
      <p className="text-[10px] text-brand-lavanda/40">{label}</p>
    </div>
  )
}

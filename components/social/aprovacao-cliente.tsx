'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, MessageSquareWarning, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarioMes, LegendaFormatos } from '@/components/social/calendario-mes'
import { PostCard } from '@/components/social/post-card'
import { PdfBotao } from '@/components/social/pdf-botao'
import { aprovarPendentes, responderPost } from '@/app/plano/[token]/actions'
import { nomePeriodo, type Post } from '@/lib/social/tipos'

type Plano = { id: string; mes: string; fim: string | null; objetivo: string | null; status: string; clienteNome: string; contatoNome: string }
type Acao = { tipo: 'aprovar' | 'ajustes'; post: Post } | { tipo: 'todos' }

const CHAVE_NOME = 'slick-plano-nome'

export function AprovacaoCliente({ token, plano, posts, agenciaNome, logoUrl, previa }: {
  token: string
  plano: Plano
  posts: Post[]
  agenciaNome: string
  logoUrl: string | null
  previa: boolean
}) {
  const router = useRouter()
  const [acao, setAcao] = useState<Acao | null>(null)
  const [nome, setNome] = useState(plano.contatoNome)
  const [comentario, setComentario] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()

  // Lembra o nome de quem respondeu neste navegador (só conveniência).
  useEffect(() => {
    try { const salvo = localStorage.getItem(CHAVE_NOME); if (salvo) setNome(salvo) } catch {}
  }, [])

  const aprovados = posts.filter((p) => p.aprovacao === 'aprovado').length
  const aguardando = posts.filter((p) => p.aprovacao === 'pendente').length
  const tudoAprovado = posts.length > 0 && aprovados === posts.length

  function abrir(a: Acao) {
    setErro(null)
    setComentario(a.tipo === 'ajustes' ? a.post.comentario_cliente ?? '' : '')
    setAcao(a)
  }

  function confirmar() {
    if (!acao) return
    setErro(null)
    try { localStorage.setItem(CHAVE_NOME, nome.trim()) } catch {}
    startTransition(async () => {
      const r = acao.tipo === 'todos'
        ? await aprovarPendentes(token, nome)
        : await responderPost(token, acao.post.id, { aprovar: acao.tipo === 'aprovar', nome, comentario })
      if (r.success) {
        setAcao(null)
        router.refresh()
      } else {
        setErro(r.error)
      }
    })
  }

  const irPara = (p: Post) => document.getElementById(`post-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="min-h-screen bg-brand-noite">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-brand-noite/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-brand-lima">
              {logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logoUrl} alt={agenciaNome} className="h-full w-full object-contain" />
                : <span className="text-sm font-black text-brand-noite">{agenciaNome[0]}</span>}
            </div>
            <div>
              <p className="text-sm font-bold leading-none text-brand-lavanda">{agenciaNome.toLowerCase()}</p>
              <p className="mt-0.5 text-[10px] text-brand-lavanda/40">Planejamento de conteúdo</p>
            </div>
          </div>
          <PdfBotao rotulo="Baixar PDF" cliente={plano.clienteNome} mes={plano.mes} fim={plano.fim} objetivo={plano.objetivo} posts={posts} logoUrl={logoUrl} agenciaNome={agenciaNome} comAprovacao={false} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-6 md:py-10">
        {previa && (
          <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2 text-xs text-yellow-400">
            Pré-visualização: o planejamento ainda é rascunho, o cliente não consegue abrir este link.
          </p>
        )}

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-lima">Planejamento de social media</p>
          <h1 className="text-3xl font-bold text-brand-lavanda md:text-4xl" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{plano.clienteNome}</h1>
          <p className="mt-1 text-lg text-brand-lavanda/50">{nomePeriodo(plano.mes, plano.fim)}</p>
          {plano.objetivo && <p className="mt-4 max-w-2xl whitespace-pre-wrap text-brand-lavanda/80">{plano.objetivo}</p>}

          <div className="mt-6 max-w-md">
            <div className="mb-1.5 flex justify-between text-xs text-brand-lavanda/50">
              <span>{aprovados} de {posts.length} posts aprovados</span>
              {aguardando > 0 && <span>{aguardando} aguardando você</span>}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full bg-brand-lima transition-all" style={{ width: `${posts.length ? (aprovados / posts.length) * 100 : 0}%` }} />
            </div>
          </div>

          {tudoAprovado && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-brand-lima/25 bg-brand-lima/[0.06] p-4 text-sm text-brand-lima">
              <PartyPopper className="h-5 w-5 shrink-0" /> Tudo aprovado! Obrigado. A {agenciaNome} já segue com a produção e as publicações.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-lavanda/60">Calendário</h2>
            <LegendaFormatos />
          </div>
          <CalendarioMes mes={plano.mes} fim={plano.fim} posts={posts} onPost={irPara} />
          <p className="text-xs text-brand-lavanda/40">Toque em um post para ver os detalhes. Contorno verde = aprovado; rosa = ajuste pedido.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-lavanda/60">Posts</h2>
          {posts.length === 0 && <p className="py-10 text-center text-sm text-brand-lavanda/40">Nenhum post neste planejamento ainda.</p>}
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              acoes={
                <>
                  {p.aprovacao !== 'aprovado' && <Button size="sm" onClick={() => abrir({ tipo: 'aprovar', post: p })}><CheckCircle2 className="h-4 w-4" /> Aprovar</Button>}
                  <Button size="sm" variant="outline" onClick={() => abrir({ tipo: 'ajustes', post: p })}>
                    <MessageSquareWarning className="h-4 w-4" /> {p.aprovacao === 'ajustes' ? 'Editar pedido de ajuste' : 'Pedir ajuste'}
                  </Button>
                </>
              }
            />
          ))}
        </section>
      </main>

      {aguardando > 0 && (
        <div className="sticky bottom-0 border-t border-white/[0.06] bg-brand-noite/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
            <p className="text-sm text-brand-lavanda/70">{aguardando} post{aguardando > 1 ? 's' : ''} aguardando aprovação</p>
            <Button onClick={() => abrir({ tipo: 'todos' })}><CheckCircle2 className="h-4 w-4" /> Aprovar {aguardando > 1 ? 'todos' : ''}</Button>
          </div>
        </div>
      )}

      <Dialog open={!!acao} onOpenChange={(o) => !o && !pendente && setAcao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acao?.tipo === 'todos' ? `Aprovar ${aguardando} post${aguardando > 1 ? 's' : ''}` : acao?.tipo === 'aprovar' ? 'Aprovar post' : 'Pedir ajuste'}
            </DialogTitle>
            <DialogDescription>
              {acao?.tipo === 'todos'
                ? 'Aprova todos os posts que ainda estão aguardando. Os que têm pedido de ajuste continuam como estão.'
                : acao && 'post' in acao ? `"${acao.post.titulo}"` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nome-resp">Seu nome</Label>
              <Input id="nome-resp" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            {acao?.tipo !== 'todos' && (
              <div className="space-y-1.5">
                <Label htmlFor="com-resp">{acao?.tipo === 'aprovar' ? 'Comentário (opcional)' : 'O que ajustar *'}</Label>
                <Textarea id="com-resp" rows={acao?.tipo === 'aprovar' ? 2 : 5} value={comentario} onChange={(e) => setComentario(e.target.value)}
                  placeholder={acao?.tipo === 'ajustes' ? 'Ex.: trocar a foto, mudar o horário, falar do novo produto…' : undefined} />
              </div>
            )}
            {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAcao(null)} disabled={pendente}>Cancelar</Button>
            <Button onClick={confirmar} disabled={pendente}>
              {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : acao?.tipo === 'ajustes' ? 'Enviar ajuste' : 'Confirmar aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

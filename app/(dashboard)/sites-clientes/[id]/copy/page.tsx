'use client'

import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ClipboardCopy, Copy, Eye, History, Loader2, Lock, MessageSquare, Plus, RefreshCw, RotateCcw, Send, Sparkles, Trash2, X,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Carregando } from '@/components/ui/carregando'
import { EstadoVazio } from '@/components/ui/estado-vazio'
import { TextoCopy } from '@/components/sites-clientes/texto-copy'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import {
  COPY_SECAO_SELECT, SECOES_SUGERIDAS, copyComoTexto, copyStatusConfig, novoCampoCopy, resumoCopy, secaoTemConteudo,
  type CopyCampo, type CopyEvento, type CopySecao,
} from '@/lib/sites-clientes/copy'

type Site = {
  id: string
  nome: string
  copy_rodada: number
  copy_enviada_em: string | null
  copy_token: string
}

const db = () => createClient() as any

export default function CopySitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [site, setSite] = useState<Site | null>(null)
  const [secoes, setSecoes] = useState<CopySecao[]>([])
  const [eventos, setEventos] = useState<CopyEvento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [salvando, setSalvando] = useState(0)
  const [previa, setPrevia] = useState(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    async function load() {
      const [{ data: s, error }, { data: sec }, { data: ev }] = await Promise.all([
        db().from('sites_clientes').select('id, nome, copy_rodada, copy_enviada_em, copy_token').eq('id', id).maybeSingle(),
        db().from('site_copy_secoes').select(COPY_SECAO_SELECT).eq('site_id', id).order('ordem'),
        db().from('site_copy_eventos').select('id, secao_id, rodada, tipo, comentario, autor, created_at').eq('site_id', id).order('created_at', { ascending: false }).limit(200),
      ])
      if (error) setErro('Não foi possível carregar. As migrations 20261112000000_site_copy.sql e 20261113000000_copy_link.sql já foram aplicadas no Supabase?')
      setSite(s)
      setSecoes((sec as CopySecao[]) ?? [])
      setEventos((ev as CopyEvento[]) ?? [])
      setCarregando(false)
    }
    load()
  }, [id])

  // Salva a seção 800 ms depois da última mudança.
  function alterar(secaoId: string, patch: Partial<Pick<CopySecao, 'titulo' | 'observacao' | 'campos'>>) {
    setAviso(null)
    setSecoes((ss) => {
      const novas = ss.map((s) => (s.id === secaoId ? { ...s, ...patch } : s))
      const alvo = novas.find((s) => s.id === secaoId)!
      clearTimeout(timers.current[secaoId])
      timers.current[secaoId] = setTimeout(async () => {
        delete timers.current[secaoId]
        setSalvando((n) => n + 1)
        const { error } = await db().from('site_copy_secoes').update({
          titulo: alvo.titulo, observacao: alvo.observacao || null, campos: alvo.campos, updated_at: new Date().toISOString(),
        }).eq('id', secaoId)
        setSalvando((n) => n - 1)
        if (error) setErro('Não foi possível salvar a última mudança.')
      }, 800)
      return novas
    })
  }

  async function adicionar(modelos: { titulo: string; campos: string[] }[]) {
    const base = secoes.reduce((m, s) => Math.max(m, s.ordem), 0)
    const { data, error } = await db().from('site_copy_secoes')
      .insert(modelos.map((m, i) => ({ site_id: id, ordem: base + i + 1, titulo: m.titulo, campos: m.campos.map((r) => novoCampoCopy(r)) })))
      .select(COPY_SECAO_SELECT)
    if (error) return setErro('Não foi possível criar a seção.')
    setSecoes((ss) => [...ss, ...(data as CopySecao[])])
  }

  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= secoes.length) return
    const a = secoes[i], b = secoes[j]
    const novas = [...secoes]
    novas[i] = { ...b, ordem: a.ordem }
    novas[j] = { ...a, ordem: b.ordem }
    setSecoes(novas)
    await Promise.all([
      db().from('site_copy_secoes').update({ ordem: b.ordem }).eq('id', a.id),
      db().from('site_copy_secoes').update({ ordem: a.ordem }).eq('id', b.id),
    ])
  }

  async function remover(s: CopySecao) {
    const aviso = s.status === 'rascunho' ? '' : ' O cliente já viu esta seção; ela some do portal dele.'
    if (!window.confirm(`Apagar a seção "${s.titulo}"?${aviso}`)) return
    const { error } = await db().from('site_copy_secoes').delete().eq('id', s.id)
    if (error) return setErro('Não foi possível apagar.')
    setSecoes((ss) => ss.filter((x) => x.id !== s.id))
  }

  async function reabrir(s: CopySecao) {
    if (!window.confirm(`Reabrir "${s.titulo}" para editar? Ela volta para rascunho e precisa ser aprovada de novo.`)) return
    const { error } = await db().from('site_copy_secoes').update({ status: 'rascunho', updated_at: new Date().toISOString() }).eq('id', s.id)
    if (error) return setErro('Não foi possível reabrir.')
    await registrar([{ secao_id: s.id, rodada: s.rodada, tipo: 'reaberta' }])
    setSecoes((ss) => ss.map((x) => (x.id === s.id ? { ...x, status: 'rascunho' } : x)))
  }

  async function registrar(itens: { secao_id: string; rodada: number; tipo: CopyEvento['tipo'] }[]) {
    const { data: { user } } = await createClient().auth.getUser()
    const autor = user?.email ?? 'Slick'
    const { data } = await db().from('site_copy_eventos').insert(itens.map((e) => ({ ...e, site_id: id, autor }))).select('id, secao_id, rodada, tipo, comentario, autor, created_at')
    if (data) setEventos((ev) => [...(data as CopyEvento[]), ...ev])
  }

  async function enviar() {
    if (!site) return
    const prontas = secoes.filter((s) => (s.status === 'rascunho' || s.status === 'ajustes') && secaoTemConteudo(s))
    const vazias = secoes.filter((s) => s.status === 'rascunho' && !secaoTemConteudo(s))
    if (prontas.length === 0) return setErro('Nada para enviar: escreva o texto de pelo menos uma seção.')
    const msg = `Enviar ${prontas.length} ${prontas.length === 1 ? 'seção' : 'seções'} para o cliente aprovar?` +
      (vazias.length ? `\n\n${vazias.length} sem texto ficam de fora: ${vazias.map((s) => s.titulo).join(', ')}.` : '')
    if (!window.confirm(msg)) return

    // Salva agora o que ainda estava esperando o salvamento automático.
    const pendentes = new Set([...Object.keys(timers.current), ...prontas.map((s) => s.id)])
    Object.values(timers.current).forEach(clearTimeout)
    timers.current = {}
    setEnviando(true)
    setErro(null)
    await Promise.all(secoes.filter((s) => pendentes.has(s.id)).map((s) =>
      db().from('site_copy_secoes').update({ titulo: s.titulo, observacao: s.observacao || null, campos: s.campos }).eq('id', s.id)))

    const rodada = site.copy_rodada + 1
    const agora = new Date().toISOString()
    const ids = prontas.map((s) => s.id)
    const { error } = await db().from('site_copy_secoes')
      .update({ status: 'aguardando', rodada, comentario_cliente: null, respondido_em: null, respondido_nome: null, updated_at: agora })
      .in('id', ids)
    if (error) { setEnviando(false); return setErro('Não foi possível enviar.') }
    await db().from('sites_clientes').update({ copy_rodada: rodada, copy_enviada_em: agora }).eq('id', id)
    await registrar(ids.map((secao_id) => ({ secao_id, rodada, tipo: 'enviada' as const })))
    setSite({ ...site, copy_rodada: rodada, copy_enviada_em: agora })
    setSecoes((ss) => ss.map((s) => (ids.includes(s.id) ? { ...s, status: 'aguardando', rodada, comentario_cliente: null, respondido_em: null, respondido_nome: null } : s)))
    setEnviando(false)
    setAviso(`Rodada ${rodada} enviada. Mande o link da copy para o cliente (é o mesmo link em todas as rodadas); você recebe um aviso no sino quando ele terminar de revisar.`)
  }

  async function copiarLink() {
    if (!site) return
    await navigator.clipboard.writeText(`${window.location.origin}/copy/${site.copy_token}`)
    setAviso('Link da copy copiado. Nele o cliente vê só a copy e aprova, sem o resto do portal.')
  }

  async function novoLink() {
    if (!site) return
    if (!window.confirm('Gerar um link novo? O link antigo para de funcionar na hora.')) return
    const copy_token = crypto.randomUUID()
    const { error } = await db().from('sites_clientes').update({ copy_token }).eq('id', id)
    if (error) return setErro('Não foi possível gerar o link.')
    setSite({ ...site, copy_token })
    await navigator.clipboard.writeText(`${window.location.origin}/copy/${copy_token}`)
    setAviso('Link novo gerado e copiado. O antigo já não funciona.')
  }

  async function copiarTexto() {
    await navigator.clipboard.writeText(copyComoTexto(secoes))
    setAviso('Copy inteira copiada como texto.')
  }

  if (carregando) return <Carregando />
  if (!site) return <div className="p-6"><EstadoVazio titulo="Site não encontrado" texto={erro ?? undefined} acao={{ label: 'Voltar para sites', href: '/sites-clientes' }} /></div>

  const r = resumoCopy(secoes)
  const porcento = r.total ? Math.round((r.aprovadas / r.total) * 100) : 0

  return (
    <div className="flex min-h-screen flex-col">
      <Header title={`Copy · ${site.nome}`} description="Textos do site para o cliente aprovar antes do desenvolvimento" />

      <main className="flex-1 space-y-5 p-4 md:p-6">
        <Link href={`/sites-clientes/${id}`} className="flex items-center gap-1.5 text-sm text-brand-lavanda/50 hover:text-brand-lavanda">
          <ArrowLeft className="h-4 w-4" /> {site.nome}
        </Link>

        {/* Resumo e ações */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-[220px] flex-1">
              <p className="text-sm text-brand-lavanda">
                <span className="font-semibold">{r.aprovadas} de {r.total}</span> seções aprovadas
                {site.copy_rodada > 0 && <span className="text-brand-lavanda/40"> · rodada {site.copy_rodada}, enviada {formatDate(site.copy_enviada_em, "dd/MM 'às' HH:mm")}</span>}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-brand-lima transition-all" style={{ width: `${porcento}%` }} />
              </div>
              <p className="mt-2 text-xs text-brand-lavanda/45">
                {r.aguardando > 0 && <>{r.aguardando} com o cliente · </>}
                {r.ajustes > 0 && <span className="text-brand-rosa">{r.ajustes} com pedido de ajuste · </span>}
                {salvando > 0 ? 'salvando…' : 'tudo salvo'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setPrevia((p) => !p)}>
                <Eye className="h-3.5 w-3.5" /> {previa ? 'Editar' : 'Ver como o cliente'}
              </Button>
              {secoes.length > 0 && <Button size="sm" variant="ghost" className="gap-1.5" onClick={copiarTexto}><ClipboardCopy className="h-3.5 w-3.5" /> Copiar texto</Button>}
              {site.copy_rodada > 0 && (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={copiarLink}><Copy className="h-3.5 w-3.5" /> Copiar link da copy</Button>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-brand-lavanda/50" onClick={novoLink} title="Gera um link novo e desliga o antigo"><RefreshCw className="h-3.5 w-3.5" /> Novo link</Button>
                </>
              )}
              <Button size="sm" className="gap-1.5" onClick={enviar} disabled={enviando || r.paraEnviar === 0}>
                {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {site.copy_rodada === 0 ? 'Enviar para aprovação' : `Enviar rodada ${site.copy_rodada + 1}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {erro && <p className="flex items-center justify-between rounded-lg bg-brand-rosa/10 px-3 py-2 text-sm text-brand-rosa">{erro}<button onClick={() => setErro(null)}><X className="h-4 w-4" /></button></p>}
        {aviso && <p className="rounded-lg bg-brand-lima/10 px-3 py-2 text-sm text-brand-lima">{aviso}</p>}

        {secoes.length === 0 ? (
          <Card>
            <EstadoVazio
              icone={Sparkles}
              titulo="Nenhuma seção ainda"
              texto="Monte a copy por seções do site. Comece com as seções mais comuns e ajuste, ou crie do zero."
              acao={{ label: 'Começar com seções sugeridas', onClick: () => adicionar(SECOES_SUGERIDAS), icon: Sparkles }}
            />
            <div className="-mt-6 pb-8 text-center">
              <button className="text-xs text-brand-lavanda/45 hover:text-brand-lavanda" onClick={() => adicionar([{ titulo: 'Nova seção', campos: ['Título', 'Texto'] }])}>ou criar uma seção vazia</button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {!previa && (
              <p className="text-xs text-brand-lavanda/40">
                Use <span className="font-mono text-brand-lavanda/70">*destaque*</span>, <span className="font-mono text-brand-lavanda/70">**negrito**</span> e uma linha em branco para separar parágrafos. O cliente vê formatado.
              </p>
            )}
            {secoes.map((s, i) => (
              <SecaoCard
                key={s.id}
                secao={s}
                numero={i + 1}
                previa={previa}
                eventos={eventos.filter((e) => e.secao_id === s.id)}
                primeira={i === 0}
                ultima={i === secoes.length - 1}
                onAlterar={(p) => alterar(s.id, p)}
                onMover={(d) => mover(i, d)}
                onRemover={() => remover(s)}
                onReabrir={() => reabrir(s)}
              />
            ))}
            {!previa && (
              <Button variant="outline" className="gap-1.5" onClick={() => adicionar([{ titulo: 'Nova seção', campos: ['Título', 'Texto'] }])}>
                <Plus className="h-4 w-4" /> Adicionar seção
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function SecaoCard({ secao: s, numero, previa, eventos, primeira, ultima, onAlterar, onMover, onRemover, onReabrir }: {
  secao: CopySecao
  numero: number
  previa: boolean
  eventos: CopyEvento[]
  primeira: boolean
  ultima: boolean
  onAlterar: (p: Partial<Pick<CopySecao, 'titulo' | 'observacao' | 'campos'>>) => void
  onMover: (d: -1 | 1) => void
  onRemover: () => void
  onReabrir: () => void
}) {
  const [historico, setHistorico] = useState(false)
  const travada = s.status === 'aprovada'
  const status = copyStatusConfig[s.status]

  function campo(i: number, patch: Partial<CopyCampo>) {
    onAlterar({ campos: s.campos.map((c, k) => (k === i ? { ...c, ...patch } : c)) })
  }
  function moverCampo(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= s.campos.length) return
    const novos = [...s.campos]
    ;[novos[i], novos[j]] = [novos[j], novos[i]]
    onAlterar({ campos: novos })
  }

  return (
    <Card className={cn(s.status === 'ajustes' && 'border-brand-rosa/40', s.status === 'aprovada' && 'border-brand-lima/25')}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-brand-lavanda/30">{String(numero).padStart(2, '0')}</span>
          {previa || travada
            ? <p className="flex-1 font-semibold text-brand-lavanda">{s.titulo}</p>
            : <Input value={s.titulo} onChange={(e) => onAlterar({ titulo: e.target.value })} className="h-9 flex-1 font-semibold" aria-label="Nome da seção" />}
          <Badge variant={status.variant}>{status.label}{s.rodada > 0 && s.status !== 'rascunho' ? ` · R${s.rodada}` : ''}</Badge>
          {!previa && (
            <div className="flex items-center">
              {eventos.length > 0 && <IconeBotao titulo="Histórico" onClick={() => setHistorico((h) => !h)}><History className="h-3.5 w-3.5" /></IconeBotao>}
              <IconeBotao titulo="Subir" onClick={() => onMover(-1)} desativado={primeira}><ArrowUp className="h-3.5 w-3.5" /></IconeBotao>
              <IconeBotao titulo="Descer" onClick={() => onMover(1)} desativado={ultima}><ArrowDown className="h-3.5 w-3.5" /></IconeBotao>
              <IconeBotao titulo="Apagar seção" onClick={onRemover} perigo><Trash2 className="h-3.5 w-3.5" /></IconeBotao>
            </div>
          )}
        </div>

        {s.status === 'ajustes' && s.comentario_cliente && (
          <div className="rounded-lg border border-brand-rosa/30 bg-brand-rosa/[0.06] p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-brand-rosa"><MessageSquare className="h-3.5 w-3.5" /> {s.respondido_nome || 'Cliente'} pediu ajuste {s.respondido_em && <span className="font-normal text-brand-lavanda/40">· {formatDate(s.respondido_em, "dd/MM 'às' HH:mm")}</span>}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-brand-lavanda/85">{s.comentario_cliente}</p>
          </div>
        )}
        {s.status === 'aprovada' && (
          <p className="flex items-center gap-1.5 text-xs text-brand-lima">
            <Check className="h-3.5 w-3.5" /> Aprovada por {s.respondido_nome || 'cliente'}{s.respondido_em && <> em {formatDate(s.respondido_em, "dd/MM 'às' HH:mm")}</>}
            {!previa && <button onClick={onReabrir} className="ml-2 flex items-center gap-1 text-brand-lavanda/45 hover:text-brand-lavanda"><RotateCcw className="h-3 w-3" /> Reabrir</button>}
          </p>
        )}
        {s.status === 'aguardando' && !previa && (
          <p className="text-xs text-brand-lavanda/40">O cliente já está vendo esta seção. Correções pequenas aparecem para ele na hora.</p>
        )}

        {previa || travada ? (
          <div className="space-y-4">
            {s.observacao && <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-sm italic text-brand-lavanda/55">{s.observacao}</p>}
            {s.campos.filter((c) => c.texto.trim()).map((c) => (
              <div key={c._id}>
                {c.rotulo && <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-brand-lavanda/35">{c.rotulo}</p>}
                <TextoCopy texto={c.texto} className="text-[15px] leading-relaxed text-brand-lavanda/85" />
              </div>
            ))}
            {travada && !previa && <p className="flex items-center gap-1.5 text-[11px] text-brand-lavanda/30"><Lock className="h-3 w-3" /> Aprovada: reabra para editar.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <Input value={s.observacao ?? ''} onChange={(e) => onAlterar({ observacao: e.target.value })} placeholder="Observação para o cliente (opcional): ex. “essa é a primeira frase que ele vê”" className="text-sm" />
            {s.campos.map((c, i) => (
              <div key={c._id} className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Input value={c.rotulo} onChange={(e) => campo(i, { rotulo: e.target.value })} placeholder="Nome (Título, Texto, Botão…)" className="h-8 max-w-[240px] text-xs" />
                  <div className="ml-auto flex">
                    <IconeBotao titulo="Subir" onClick={() => moverCampo(i, -1)} desativado={i === 0}><ArrowUp className="h-3 w-3" /></IconeBotao>
                    <IconeBotao titulo="Descer" onClick={() => moverCampo(i, 1)} desativado={i === s.campos.length - 1}><ArrowDown className="h-3 w-3" /></IconeBotao>
                    <IconeBotao titulo="Remover texto" onClick={() => onAlterar({ campos: s.campos.filter((_, k) => k !== i) })} perigo><Trash2 className="h-3 w-3" /></IconeBotao>
                  </div>
                </div>
                <Textarea value={c.texto} onChange={(e) => campo(i, { texto: e.target.value })} rows={Math.min(14, Math.max(2, Math.ceil(c.texto.length / 90) + c.texto.split('\n').length))} placeholder="Escreva o texto…" />
              </div>
            ))}
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => onAlterar({ campos: [...s.campos, novoCampoCopy()] })}>
              <Plus className="h-3.5 w-3.5" /> Adicionar texto
            </Button>
          </div>
        )}

        {historico && !previa && (
          <ul className="space-y-1 border-t border-white/[0.06] pt-3 text-xs text-brand-lavanda/50">
            {eventos.map((e) => (
              <li key={e.id}>
                <span className="text-brand-lavanda/35">{formatDate(e.created_at, "dd/MM HH:mm")}</span> · R{e.rodada} · {
                  { enviada: 'enviada ao cliente', aprovada: 'aprovada', ajustes: 'pedido de ajuste', reaberta: 'reaberta para edição' }[e.tipo]
                }{e.autor && <> por {e.autor}</>}{e.comentario && <>: “{e.comentario}”</>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function IconeBotao({ children, titulo, onClick, desativado, perigo }: {
  children: React.ReactNode
  titulo: string
  onClick: () => void
  desativado?: boolean
  perigo?: boolean
}) {
  return (
    <button type="button" title={titulo} aria-label={titulo} onClick={onClick} disabled={desativado}
      className={cn('flex h-8 w-8 items-center justify-center rounded-md text-brand-lavanda/40 transition-colors hover:bg-white/[0.05] disabled:pointer-events-none disabled:opacity-25',
        perigo ? 'hover:text-brand-rosa' : 'hover:text-brand-lavanda')}>
      {children}
    </button>
  )
}

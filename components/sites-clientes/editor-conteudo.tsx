'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Check, ChevronDown, ExternalLink, History, ImageUp, Loader2, Plus, RefreshCw, RotateCcw, Trash2, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, formatRelative } from '@/lib/utils'
import {
  igual, limiteCampo, limparConteudo, novoIdItem, problemasConteudo, valorAtual,
  type Campo, type CampoLista, type Conteudo, type Estrutura, type ItemLista, type Secao, type Subcampo, type ValorCampo,
} from '@/lib/sites-clientes/conteudo'
import { descartarRascunho, prepararUpload, publicar, restaurarVersao, salvarRascunho, sincronizarEstrutura } from '@/lib/sites-clientes/editor-actions'
import type { DadosEditor } from '@/lib/sites-clientes/editor-dados'

type Status = { tipo: 'ok' | 'erro' | 'info'; texto: string } | null

export function EditorConteudo({ siteId, siteUrl, dados, equipe }: {
  siteId: string
  siteUrl: string | null
  dados: DadosEditor
  equipe: boolean          // equipe vê "Atualizar estrutura"
}) {
  const [estrutura, setEstrutura] = useState<Estrutura | null>(dados.estrutura)
  const [conteudo, setConteudo] = useState<Conteudo>(dados.rascunho)
  const [salvo, setSalvo] = useState<Conteudo>(dados.rascunho)
  const [publicado, setPublicado] = useState<Conteudo | null>(dados.publicado)
  const [publicadoEm, setPublicadoEm] = useState(dados.publicadoEm)
  const [secaoId, setSecaoId] = useState(dados.estrutura?.secoes[0]?.id ?? '')
  const [salvando, setSalvando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [historico, setHistorico] = useState(false)

  const limpo = useMemo(() => (estrutura ? limparConteudo(estrutura, conteudo) : {}), [estrutura, conteudo])
  const limpoPublicado = useMemo(() => (estrutura ? limparConteudo(estrutura, publicado ?? {}) : {}), [estrutura, publicado])
  const naoSalvo = estrutura ? !igual(limpo, limparConteudo(estrutura, salvo)) : false
  const naoPublicado = !igual(limpo, limpoPublicado)

  // Salva o rascunho sozinho 1,5 s depois da última mudança.
  const salvar = useCallback(async (valores: Conteudo) => {
    setSalvando(true)
    const r = await salvarRascunho(siteId, valores)
    setSalvando(false)
    if (r.ok) setSalvo(valores)
    else setStatus({ tipo: 'erro', texto: r.erro })
  }, [siteId])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!naoSalvo) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => salvar(conteudo), 1500)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [conteudo, naoSalvo, salvar])

  // Avisa antes de fechar a aba com mudança ainda não salva.
  useEffect(() => {
    if (!naoSalvo) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [naoSalvo])

  function mudar(secao: Secao, campo: Campo, valor: ValorCampo) {
    setStatus(null)
    setConteudo((c) => ({ ...c, [secao.id]: { ...(c[secao.id] ?? {}), [campo.id]: valor } }))
  }

  function voltarPadrao(secao: Secao, campo: Campo) {
    setConteudo((c) => {
      const s = { ...(c[secao.id] ?? {}) }
      delete s[campo.id]
      return { ...c, [secao.id]: s }
    })
  }

  async function fazerPublicacao() {
    if (!estrutura) return
    const problemas = problemasConteudo(estrutura, conteudo)
    if (problemas.length > 0) return setStatus({ tipo: 'erro', texto: problemas.join(' ') })
    if (timer.current) clearTimeout(timer.current)
    setPublicando(true)
    const r = await publicar(siteId, conteudo)
    setPublicando(false)
    if (!r.ok) return setStatus({ tipo: 'erro', texto: r.erro })
    setSalvo(conteudo)
    setPublicado(limparConteudo(estrutura, conteudo))
    setPublicadoEm(new Date().toISOString())
    setStatus(r.noAr
      ? { tipo: 'ok', texto: 'Publicado! O site já mostra as mudanças (pode levar alguns segundos).' }
      : { tipo: 'info', texto: 'Publicado. O site atualiza sozinho em até 5 minutos.' })
  }

  async function descartar() {
    if (!window.confirm('Descartar todas as mudanças que ainda não foram publicadas?')) return
    const r = await descartarRascunho(siteId)
    if (!r.ok) return setStatus({ tipo: 'erro', texto: r.erro })
    setConteudo(r.conteudo)
    setSalvo(r.conteudo)
    setStatus({ tipo: 'info', texto: 'Mudanças descartadas. O editor voltou para o que está no ar.' })
  }

  async function restaurar(versaoId: string) {
    if (!window.confirm('Carregar esta versão no editor? Ela só vai para o site quando você publicar.')) return
    const r = await restaurarVersao(siteId, versaoId)
    if (!r.ok) return setStatus({ tipo: 'erro', texto: r.erro })
    setConteudo(r.conteudo)
    setSalvo(r.conteudo)
    setHistorico(false)
    setStatus({ tipo: 'info', texto: 'Versão carregada. Confira e clique em Publicar para colocar no ar.' })
  }

  async function sincronizar() {
    setSincronizando(true)
    const r = await sincronizarEstrutura(siteId)
    setSincronizando(false)
    if (!r.ok) return setStatus({ tipo: 'erro', texto: r.erro })
    setStatus({ tipo: 'ok', texto: `Estrutura atualizada: ${r.secoes} seções.` })
    window.location.reload()
  }

  if (!estrutura) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="font-medium text-brand-lavanda">O editor deste site ainda não foi ligado.</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-lavanda/50">
          {equipe
            ? 'Depois de publicar o site com o editor (rota /api/slick/schema), busque a estrutura de seções aqui.'
            : 'A equipe da Slick está preparando a edição do seu site. Assim que estiver pronta, ela aparece aqui.'}
        </p>
        {status && <StatusLinha status={status} className="mt-4 justify-center" />}
        {equipe && (
          <Button className="mt-5 gap-2" onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Buscar estrutura no site
          </Button>
        )}
      </div>
    )
  }

  const secao = estrutura.secoes.find((s) => s.id === secaoId) ?? estrutura.secoes[0]
  const secaoMudou = (s: Secao) => !igual(limpo[s.id], limpoPublicado[s.id])

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-white/[0.06] bg-brand-noite/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="min-w-0 flex-1 text-xs">
          {salvando ? (
            <span className="flex items-center gap-1.5 text-brand-lavanda/50"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando rascunho…</span>
          ) : naoSalvo ? (
            <span className="text-brand-lavanda/50">Alterações sendo salvas…</span>
          ) : naoPublicado ? (
            <span className="text-yellow-400">Rascunho salvo · ainda não está no site</span>
          ) : (
            <span className="flex items-center gap-1.5 text-brand-lima"><Check className="h-3.5 w-3.5" /> Tudo publicado{publicadoEm && <span className="text-brand-lavanda/40">· {formatRelative(publicadoEm)}</span>}</span>
          )}
        </div>
        {siteUrl && (
          <Button size="sm" variant="ghost" asChild>
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Ver site</a>
          </Button>
        )}
        {dados.versoes.length > 0 && (
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setHistorico((h) => !h)}>
            <History className="h-3.5 w-3.5" /> Histórico
          </Button>
        )}
        {naoPublicado && publicado && (
          <Button size="sm" variant="outline" onClick={descartar}>Descartar mudanças</Button>
        )}
        <Button size="sm" onClick={fazerPublicacao} disabled={publicando || !naoPublicado} className="gap-1.5">
          {publicando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Publicar
        </Button>
      </div>

      {status && <StatusLinha status={status} />}

      {historico && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="mb-2 text-sm font-medium text-brand-lavanda">Versões publicadas</p>
          <ul className="divide-y divide-white/[0.06] text-sm">
            {dados.versoes.map((v, i) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-brand-lavanda/70">
                  {formatDate(v.created_at, "dd/MM/yyyy 'às' HH:mm")}
                  {v.publicado_por && <span className="text-brand-lavanda/40"> · {v.publicado_por}</span>}
                  {i === 0 && <span className="ml-2 text-xs text-brand-lima">no ar</span>}
                </span>
                {i > 0 && <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => restaurar(v.id)}><RotateCcw className="h-3.5 w-3.5" /> Carregar</Button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Seções */}
        <nav aria-label="Seções do site" className="lg:sticky lg:top-20 lg:self-start">
          <select
            className="h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-sm text-brand-lavanda lg:hidden"
            value={secao.id}
            onChange={(e) => setSecaoId(e.target.value)}
          >
            {estrutura.secoes.map((s) => <option key={s.id} value={s.id} className="bg-brand-noite">{s.titulo}{secaoMudou(s) ? ' •' : ''}</option>)}
          </select>
          <ul className="hidden space-y-0.5 lg:block">
            {estrutura.secoes.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSecaoId(s.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    s.id === secao.id ? 'bg-white/[0.06] text-brand-lavanda' : 'text-brand-lavanda/55 hover:bg-white/[0.03] hover:text-brand-lavanda/85',
                  )}
                >
                  <span className="w-5 font-mono text-[11px] text-brand-lavanda/30">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 truncate">{s.titulo}</span>
                  {secaoMudou(s) && <span title="Mudanças ainda não publicadas" className="h-2 w-2 rounded-full bg-yellow-400" />}
                </button>
              </li>
            ))}
          </ul>
          {equipe && (
            <button type="button" onClick={sincronizar} disabled={sincronizando}
              className="mt-4 hidden items-center gap-1.5 px-3 text-[11px] text-brand-lavanda/35 hover:text-brand-lavanda/70 lg:flex">
              <RefreshCw className={cn('h-3 w-3', sincronizando && 'animate-spin')} /> Atualizar estrutura do site
            </button>
          )}
        </nav>

        {/* Campos da seção */}
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
          <h2 className="text-lg font-semibold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{secao.titulo}</h2>
          {secao.descricao && <p className="mt-1 text-sm text-brand-lavanda/50">{secao.descricao}</p>}
          <p className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] text-brand-lavanda/45">
            Dica: escreva <span className="font-mono text-brand-lavanda/70">*assim*</span> para o destaque colorido e <span className="font-mono text-brand-lavanda/70">**assim**</span> para negrito.
          </p>
          <div className="mt-6 space-y-6">
            {secao.campos.map((campo) => (
              <CampoEditor
                key={`${secao.id}.${campo.id}`}
                siteId={siteId}
                siteUrl={siteUrl}
                campo={campo}
                valor={valorAtual(conteudo, secao, campo)}
                alterado={conteudo[secao.id]?.[campo.id] !== undefined && !igual(conteudo[secao.id]?.[campo.id], campo.padrao ?? (campo.tipo === 'lista' ? [] : ''))}
                onChange={(v) => mudar(secao, campo, v)}
                onPadrao={() => voltarPadrao(secao, campo)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function StatusLinha({ status, className }: { status: NonNullable<Status>; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', {
      'bg-brand-lima/10 text-brand-lima': status.tipo === 'ok',
      'bg-brand-rosa/10 text-brand-rosa': status.tipo === 'erro',
      'bg-white/[0.04] text-brand-lavanda/70': status.tipo === 'info',
    }, className)}>
      {status.texto}
    </p>
  )
}

function CampoEditor({ siteId, siteUrl, campo, valor, alterado, onChange, onPadrao }: {
  siteId: string
  siteUrl: string | null
  campo: Campo
  valor: ValorCampo
  alterado: boolean
  onChange: (v: ValorCampo) => void
  onPadrao: () => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label className="text-sm text-brand-lavanda/85">{campo.rotulo}</Label>
        {alterado && (
          <button type="button" onClick={onPadrao} className="flex items-center gap-1 text-[11px] text-brand-lavanda/35 hover:text-brand-lavanda/70">
            <RotateCcw className="h-3 w-3" /> Voltar ao original
          </button>
        )}
      </div>
      {campo.ajuda && <p className="text-xs text-brand-lavanda/40">{campo.ajuda}</p>}
      {campo.tipo === 'lista'
        ? <ListaEditor siteId={siteId} siteUrl={siteUrl} campo={campo} itens={valor as ItemLista[]} onChange={onChange} />
        : <ValorSimples siteId={siteId} siteUrl={siteUrl} campo={campo} valor={valor as string} onChange={onChange} />}
    </div>
  )
}

function ValorSimples({ siteId, siteUrl, campo, valor, onChange }: {
  siteId: string
  siteUrl: string | null
  campo: Subcampo | (Campo & { tipo: Subcampo['tipo'] })
  valor: string
  onChange: (v: string) => void
}) {
  const max = limiteCampo(campo)
  if (campo.tipo === 'imagem') return <ImagemEditor siteId={siteId} siteUrl={siteUrl} valor={valor} onChange={onChange} />
  if (campo.tipo === 'textarea') {
    return (
      <div>
        <Textarea value={valor} maxLength={max} rows={Math.min(12, Math.max(3, Math.ceil(valor.length / 70) + 1))} onChange={(e) => onChange(e.target.value)} />
        <Contador n={valor.length} max={max} />
      </div>
    )
  }
  return (
    <div>
      <Input value={valor} maxLength={max} type={campo.tipo === 'link' ? 'url' : 'text'} placeholder={campo.tipo === 'link' ? 'https://…' : undefined} onChange={(e) => onChange(e.target.value)} />
      {campo.tipo === 'texto' && <Contador n={valor.length} max={max} />}
    </div>
  )
}

function Contador({ n, max }: { n: number; max: number }) {
  if (n < max * 0.7) return null
  return <p className={cn('mt-1 text-right text-[11px]', n >= max ? 'text-brand-rosa' : 'text-brand-lavanda/35')}>{n}/{max}</p>
}

function ImagemEditor({ siteId, siteUrl, valor, onChange }: { siteId: string; siteUrl: string | null; valor: string; onChange: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Imagem padrão fica no próprio site (/fotos/...): mostra pelo endereço dele.
  const src = valor.startsWith('/') ? (siteUrl ? `${siteUrl}${valor}` : null) : valor

  async function enviar(arquivo: File) {
    setErro(null)
    setEnviando(true)
    try {
      const r = await prepararUpload(siteId, arquivo.type, arquivo.size)
      if (!r.ok) return setErro(r.erro)
      const { error } = await createClient().storage.from('sites-conteudo').uploadToSignedUrl(r.path, r.token, arquivo, { contentType: arquivo.type })
      if (error) return setErro('Não foi possível enviar a imagem. Tente de novo.')
      onChange(r.url)
    } finally {
      setEnviando(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative flex h-28 w-40 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03]">
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt="" className="h-full w-full object-cover" />
          : <ImageUp className="h-6 w-6 text-brand-lavanda/25" />}
        {enviando && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      </div>
      <div className="space-y-1.5">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f) }} />
        <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={enviando} onClick={() => input.current?.click()}>
          <ImageUp className="h-3.5 w-3.5" /> Trocar imagem
        </Button>
        <p className="text-[11px] text-brand-lavanda/35">JPG, PNG ou WEBP até 5 MB. Prefira fotos na horizontal com boa resolução.</p>
        {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
      </div>
    </div>
  )
}

function ListaEditor({ siteId, siteUrl, campo, itens, onChange }: {
  siteId: string
  siteUrl: string | null
  campo: CampoLista
  itens: ItemLista[]
  onChange: (v: ItemLista[]) => void
}) {
  const [aberto, setAberto] = useState<string | null>(null)
  const nomeItem = campo.itemRotulo || 'Item'
  const max = campo.maxItens ?? 50
  const min = campo.min ?? 0
  const primeiroTexto = campo.campos.find((c) => c.tipo === 'texto' || c.tipo === 'textarea')

  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= itens.length) return
    const novo = [...itens]
    ;[novo[i], novo[j]] = [novo[j], novo[i]]
    onChange(novo)
  }

  function adicionar() {
    const item: ItemLista = { _id: novoIdItem() }
    for (const c of campo.campos) item[c.id] = ''
    onChange([...itens, item])
    setAberto(item._id)
  }

  function remover(i: number) {
    const item = itens[i]
    const titulo = (primeiroTexto && item[primeiroTexto.id]) || `${nomeItem} ${i + 1}`
    if (!window.confirm(`Remover "${titulo.slice(0, 60)}"?`)) return
    onChange(itens.filter((_, k) => k !== i))
  }

  return (
    <div className="space-y-2">
      {itens.map((item, i) => {
        const expandido = aberto === item._id
        const titulo = (primeiroTexto && item[primeiroTexto.id]?.replace(/\*+/g, '')) || `${nomeItem} ${i + 1}`
        return (
          <div key={item._id} className="rounded-lg border border-white/[0.08] bg-white/[0.02]">
            <div className="flex items-center gap-1 pr-1.5">
              <button type="button" onClick={() => setAberto(expandido ? null : item._id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left">
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-brand-lavanda/30 transition-transform', expandido && 'rotate-180')} />
                <span className="font-mono text-[11px] text-brand-lavanda/30">{String(i + 1).padStart(2, '0')}</span>
                <span className="truncate text-sm text-brand-lavanda/85">{titulo}</span>
              </button>
              <IconeBotao titulo="Subir" onClick={() => mover(i, -1)} desativado={i === 0}><ArrowUp className="h-3.5 w-3.5" /></IconeBotao>
              <IconeBotao titulo="Descer" onClick={() => mover(i, 1)} desativado={i === itens.length - 1}><ArrowDown className="h-3.5 w-3.5" /></IconeBotao>
              <IconeBotao titulo={itens.length <= min ? `Precisa ter pelo menos ${min}` : 'Remover'} onClick={() => remover(i)} desativado={itens.length <= min} perigo>
                <Trash2 className="h-3.5 w-3.5" />
              </IconeBotao>
            </div>
            {expandido && (
              <div className="space-y-4 border-t border-white/[0.06] p-4">
                {campo.campos.map((sub) => (
                  <div key={sub.id} className="space-y-1.5">
                    <Label className="text-xs text-brand-lavanda/70">{sub.rotulo}</Label>
                    {sub.ajuda && <p className="text-[11px] text-brand-lavanda/40">{sub.ajuda}</p>}
                    <ValorSimples siteId={siteId} siteUrl={siteUrl} campo={sub} valor={item[sub.id] ?? ''}
                      onChange={(v) => onChange(itens.map((x, k) => (k === i ? { ...x, [sub.id]: v } : x)))} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={adicionar} disabled={itens.length >= max}>
        <Plus className="h-3.5 w-3.5" /> Adicionar {nomeItem.toLowerCase()}
      </Button>
      {itens.length >= max && <span className="ml-2 text-[11px] text-brand-lavanda/35">Máximo de {max}.</span>}
    </div>
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

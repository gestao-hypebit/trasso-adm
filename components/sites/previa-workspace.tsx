'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Copy, Check, ExternalLink, Eye, Loader2, MessageCircle, Monitor, Pencil, RotateCcw, Send,
  Smartphone, Sparkles, Trash2, Wand2, X,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BriefingForm } from '@/components/sites/briefing-form'
import { ConteudoEditor } from '@/components/sites/conteudo-editor'
import { createClient } from '@/lib/supabase/client'
import { STATUS_PREVIA, type Briefing, type Conteudo } from '@/lib/sites/tipos'
import { cn, formatDate, whatsappUrl } from '@/lib/utils'

type Previa = {
  id: string; nome: string; slug: string; briefing: Briefing; conteudo: Conteudo | null; status: string; erro: string | null
  html: string | null; versao_atual: number; publicada: boolean; visualizacoes: number; ultima_visualizacao: string | null
  clientes: { nome: string; telefone: string | null; whatsapp: string | null } | null
  leads: { nome: string; telefone: string | null } | null
}
type Versao = { numero: number; instrucao: string | null; created_at: string }
type Aba = 'textos' | 'ajustes' | 'versoes'

async function postJson(url: string, corpo?: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
  return json
}

const SUGESTOES = ['Deixe o topo mais impactante', 'Troque a cor principal por um tom mais escuro', 'Adicione uma seção de depoimentos', 'Deixe os botões mais chamativos']

export function PreviaWorkspace({ id, autoGerar }: { id: string; autoGerar: boolean }) {
  const router = useRouter()
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [versoes, setVersoes] = useState<Versao[]>([])
  const [conteudo, setConteudo] = useState<Conteudo | null>(null)
  const [sujo, setSujo] = useState(false)
  const [aba, setAba] = useState<Aba>('textos')
  const [dispositivo, setDispositivo] = useState<'desktop' | 'celular'>('desktop')
  const [ocupado, setOcupado] = useState<null | 'conteudo' | 'gerar' | 'editar' | 'salvar'>(null)
  const [parcial, setParcial] = useState('')
  const [tamanho, setTamanho] = useState(0)
  const [verVersao, setVerVersao] = useState<{ numero: number; html: string } | null>(null)
  const [instrucao, setInstrucao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [briefingAberto, setBriefingAberto] = useState(false)
  const [briefingEdit, setBriefingEdit] = useState<Briefing | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const autoFeito = useRef(false)
  // Textos editados e não salvos não são sobrescritos ao recarregar.
  const sujoRef = useRef(false)
  useEffect(() => { sujoRef.current = sujo }, [sujo])

  const carregar = useCallback(async () => {
    const db = createClient() as any
    const [{ data: p }, { data: v }] = await Promise.all([
      db.from('site_previas').select('*, clientes(nome, telefone, whatsapp), leads(nome, telefone)').eq('id', id).maybeSingle(),
      db.from('site_previa_versoes').select('numero, instrucao, created_at').eq('previa_id', id).order('numero', { ascending: false }),
    ])
    if (!p) { setErro('Prévia não encontrada.'); return }
    setPrevia(p)
    setVersoes(v ?? [])
    setConteudo((atual) => (sujoRef.current && atual ? atual : p.conteudo))
    return p as Previa
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  // Geração que continuou no servidor (tela recarregada no meio): acompanha até terminar.
  useEffect(() => {
    if (previa?.status !== 'gerando' || ocupado) return
    const t = setInterval(carregar, 5000)
    return () => clearInterval(t)
  }, [previa?.status, ocupado, carregar])

  const gerarTextos = useCallback(async () => {
    setOcupado('conteudo'); setErro(null); setAviso(null)
    try {
      const r = await postJson(`/api/sites/${id}/conteudo`)
      setConteudo(r.conteudo); setSujo(false); setAba('textos')
      setAviso('Textos prontos. Revise (principalmente os [marcadores]) e clique em Gerar site.')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar os textos.')
    }
    setOcupado(null)
  }, [id, carregar])

  // Veio de "Criar e gerar textos": já começa.
  useEffect(() => {
    if (!autoGerar || autoFeito.current || !previa || previa.conteudo) return
    autoFeito.current = true
    window.history.replaceState(null, '', `/sites/${id}`)
    gerarTextos()
  }, [autoGerar, previa, id, gerarTextos])

  async function salvarTextos() {
    if (!conteudo) return true
    setOcupado('salvar')
    const { error } = await (createClient() as any).from('site_previas').update({ conteudo, updated_at: new Date().toISOString() }).eq('id', id)
    setOcupado(null)
    if (error) { setErro(error.message); return false }
    setSujo(false)
    return true
  }

  async function gerarSite() {
    setErro(null); setAviso(null); setVerVersao(null)
    if (sujo && !(await salvarTextos())) return
    setOcupado('gerar'); setParcial(''); setTamanho(0)
    try {
      const res = await fetch(`/api/sites/${id}/gerar`, { method: 'POST' })
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Erro ${res.status}`)
      }
      const leitor = res.body.getReader()
      const decoder = new TextDecoder()
      let texto = ''
      let ultimaPintura = 0
      for (;;) {
        const { done, value } = await leitor.read()
        if (done) break
        texto += decoder.decode(value, { stream: true })
        setTamanho(texto.length)
        // Redesenha a prévia parcial no máximo a cada 1,5 s (evita piscar).
        if (Date.now() - ultimaPintura > 1500) { setParcial(texto); ultimaPintura = Date.now() }
      }
      const marcaErro = texto.match(/<!--ERRO:([\s\S]*?)-->\s*$/)
      if (marcaErro) throw new Error(marcaErro[1])
      setAviso('Site gerado! Copie o link e mande para o cliente, ou peça ajustes.')
      setAba('ajustes')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar o site.')
    }
    setParcial('')
    setOcupado(null)
    await carregar()
  }

  async function ajustar(pedido: string) {
    if (!pedido.trim()) return
    setOcupado('editar'); setErro(null); setAviso(null); setVerVersao(null)
    try {
      const r = await postJson(`/api/sites/${id}/editar`, { instrucao: pedido })
      setInstrucao('')
      setAviso(`Versão ${r.versao}: ${r.resumo}`)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao ajustar.')
    }
    setOcupado(null)
  }

  async function abrirVersao(numero: number) {
    const { data } = await (createClient() as any).from('site_previa_versoes').select('html').eq('previa_id', id).eq('numero', numero).maybeSingle()
    if (data) setVerVersao({ numero, html: data.html })
  }

  async function restaurar(numero: number) {
    const db = createClient() as any
    const { data } = await db.from('site_previa_versoes').select('html').eq('previa_id', id).eq('numero', numero).maybeSingle()
    if (!data) return
    const { error } = await db.from('site_previas').update({ html: data.html, versao_atual: numero, status: 'pronto', updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { setErro(error.message); return }
    setVerVersao(null)
    setAviso(`Versão ${numero} restaurada: é ela que o cliente vê agora.`)
    await carregar()
  }

  async function salvarBriefing() {
    if (!briefingEdit) return
    const { error } = await (createClient() as any).from('site_previas').update({ briefing: briefingEdit, nome: briefingEdit.empresa.trim() || previa?.nome, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { setErro(error.message); return }
    setBriefingAberto(false)
    setAviso('Briefing salvo. Gere os textos de novo para usar as mudanças.')
    await carregar()
  }

  async function alternarPublicada() {
    if (!previa) return
    await (createClient() as any).from('site_previas').update({ publicada: !previa.publicada }).eq('id', id)
    await carregar()
  }

  async function excluir() {
    const { error } = await (createClient() as any).from('site_previas').delete().eq('id', id)
    if (error) { setErro(error.message); return }
    router.push('/sites')
  }

  if (!previa) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-brand-lavanda/40">
        {erro ?? <Loader2 className="h-5 w-5 animate-spin" />}
      </div>
    )
  }

  const link = typeof window !== 'undefined' ? `${window.location.origin}/p/${previa.slug}` : `/p/${previa.slug}`
  const telefone = previa.clientes?.whatsapp ?? previa.clientes?.telefone ?? previa.leads?.telefone ?? previa.briefing.whatsapp
  const wa = previa.html ? whatsappUrl(telefone, `Olá! Preparei uma prévia de como pode ficar o site da ${previa.nome}: ${link}`) : null
  const st = STATUS_PREVIA[ocupado === 'gerar' ? 'gerando' : previa.status] ?? STATUS_PREVIA.rascunho
  const ajustesFeitos = versoes.filter((v) => v.instrucao)

  return (
    <div className="flex h-dvh flex-col">
      <Header title="Prévias de site" description={previa.nome} />

      {/* Barra da prévia */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3 md:px-6">
        <Link href="/sites" className="mr-1 rounded-md p-1 text-brand-lavanda/40 hover:bg-white/[0.06] hover:text-brand-lavanda" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
        <h1 className="mr-2 truncate text-base font-semibold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{previa.nome}</h1>
        <Badge variant={st.variant}>{st.label}</Badge>
        {previa.html && (
          <span className="flex items-center gap-1 text-xs text-brand-lavanda/40" title={previa.ultima_visualizacao ? `Última vez: ${formatDate(previa.ultima_visualizacao, 'dd/MM/yyyy HH:mm')}` : 'Ainda não abriram o link'}>
            <Eye className="h-3.5 w-3.5" /> {previa.visualizacoes} visualizaç{previa.visualizacoes === 1 ? 'ão' : 'ões'}
            {previa.ultima_visualizacao && <> · última {formatDate(previa.ultima_visualizacao, 'dd/MM HH:mm')}</>}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setBriefingEdit(previa.briefing); setBriefingAberto(true) }}><Pencil className="h-3.5 w-3.5" /> Briefing</Button>
          {previa.html && (
            <>
              <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(link).catch(() => {}); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }}>
                {copiado ? <Check className="h-3.5 w-3.5 text-brand-lima" /> : <Copy className="h-3.5 w-3.5" />} Copiar link
              </Button>
              <Button size="sm" variant="outline" asChild><a href={`/p/${previa.slug}?admin=1`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Abrir</a></Button>
              {wa && <Button size="sm" asChild><a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> Mandar no WhatsApp</a></Button>}
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Painel esquerdo */}
        <aside className="flex min-h-0 flex-col border-b border-white/[0.06] lg:w-[420px] lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex gap-1 border-b border-white/[0.06] px-4 pt-2">
            {(['textos', 'ajustes', 'versoes'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAba(a)}
                className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors', aba === a ? 'border-brand-lima text-brand-lima' : 'border-transparent text-brand-lavanda/50 hover:text-brand-lavanda')}
              >
                {a === 'textos' ? 'Textos' : a === 'ajustes' ? 'Ajustes' : `Versões (${versoes.length})`}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {aviso && (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-brand-lima/20 bg-brand-lima/[0.06] px-3 py-2 text-xs text-brand-lima">
                <span>{aviso}</span>
                <button type="button" onClick={() => setAviso(null)} aria-label="Fechar"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
            {(erro || (previa.erro && !ocupado)) && (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-brand-rosa/20 bg-brand-rosa/[0.06] px-3 py-2 text-xs text-brand-rosa">
                <span>{erro ?? previa.erro}</span>
                <button type="button" onClick={() => setErro(null)} aria-label="Fechar"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}

            {aba === 'textos' && (
              !conteudo ? (
                <div className="rounded-xl border border-dashed border-white/[0.1] p-6 text-center">
                  <Sparkles className="mx-auto mb-3 h-6 w-6 text-brand-lima" />
                  <p className="mb-1 text-sm font-medium text-brand-lavanda">Primeiro, os textos</p>
                  <p className="mb-4 text-xs text-brand-lavanda/50">A IA escreve os textos do site a partir do briefing. Você revisa antes de virar design.</p>
                  <Button onClick={gerarTextos} disabled={!!ocupado}>
                    {ocupado === 'conteudo' ? <><Loader2 className="h-4 w-4 animate-spin" /> Escrevendo… (até 1 min)</> : <><Wand2 className="h-4 w-4" /> Gerar textos</>}
                  </Button>
                </div>
              ) : (
                <>
                  <ConteudoEditor valor={conteudo} onChange={(c) => { setConteudo(c); setSujo(true) }} />
                  <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t border-white/[0.06] bg-brand-noite/95 px-4 py-3 backdrop-blur">
                    <Button onClick={gerarSite} disabled={!!ocupado} className="flex-1">
                      {ocupado === 'gerar' ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando site…</> : <><Sparkles className="h-4 w-4" /> {previa.html ? 'Gerar site de novo' : 'Gerar site'}</>}
                    </Button>
                    {sujo && <Button variant="outline" onClick={salvarTextos} disabled={!!ocupado}>Salvar textos</Button>}
                    <Button variant="ghost" onClick={gerarTextos} disabled={!!ocupado} title="Escrever os textos de novo a partir do briefing">
                      {ocupado === 'conteudo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    </Button>
                  </div>
                </>
              )
            )}

            {aba === 'ajustes' && (
              !previa.html ? (
                <p className="py-8 text-center text-xs text-brand-lavanda/40">Gere o site primeiro; depois peça ajustes aqui.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Textarea
                      rows={3}
                      value={instrucao}
                      onChange={(e) => setInstrucao(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ajustar(instrucao) }}
                      placeholder="O que mudar? Ex.: troque a foto do topo pela segunda foto e deixe o título maior"
                      disabled={!!ocupado}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-brand-lavanda/30">Ctrl + Enter para enviar</span>
                      <Button size="sm" onClick={() => ajustar(instrucao)} disabled={!!ocupado || !instrucao.trim()}>
                        {ocupado === 'editar' ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Ajustando…</> : <><Send className="h-3.5 w-3.5" /> Ajustar</>}
                      </Button>
                    </div>
                  </div>
                  {!ajustesFeitos.length && (
                    <div className="flex flex-wrap gap-1.5">
                      {SUGESTOES.map((s) => (
                        <button key={s} type="button" onClick={() => setInstrucao(s)} className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[11px] text-brand-lavanda/50 hover:text-brand-lavanda">{s}</button>
                      ))}
                    </div>
                  )}
                  {ajustesFeitos.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-wide text-brand-lavanda/40">Pedidos anteriores</p>
                      <ul className="space-y-1.5">
                        {ajustesFeitos.map((v) => (
                          <li key={v.numero} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-brand-lavanda/70">
                            <span className="text-brand-lavanda/30">v{v.numero} · </span>{v.instrucao}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )
            )}

            {aba === 'versoes' && (
              versoes.length === 0 ? (
                <p className="py-8 text-center text-xs text-brand-lavanda/40">Nenhuma versão ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {versoes.map((v) => {
                    const atual = v.numero === previa.versao_atual
                    return (
                      <li key={v.numero} className={cn('rounded-lg border px-3 py-2.5', verVersao?.numero === v.numero ? 'border-brand-violeta/40 bg-brand-violeta/[0.06]' : 'border-white/[0.06]')}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-brand-lavanda">Versão {v.numero} {atual && <Badge variant="aprovada" className="ml-1">atual</Badge>}</span>
                          <span className="text-[11px] text-brand-lavanda/40">{formatDate(v.created_at, 'dd/MM HH:mm')}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-brand-lavanda/50">{v.instrucao ?? 'Geração do site'}</p>
                        {!atual && (
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => abrirVersao(v.numero)}><Eye className="h-3.5 w-3.5" /> Ver</Button>
                            <Button size="sm" variant="outline" onClick={() => restaurar(v.numero)}><RotateCcw className="h-3.5 w-3.5" /> Restaurar</Button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )
            )}

            <div className="border-t border-white/[0.06] pt-4 text-xs text-brand-lavanda/40">
              {previa.html && (
                <label className="mb-3 flex items-center gap-2">
                  <input type="checkbox" className="accent-[#B8F000]" checked={previa.publicada} onChange={alternarPublicada} />
                  Link público ativo
                </label>
              )}
              {confirmarExclusao ? (
                <span className="flex items-center gap-2">
                  Excluir esta prévia e as versões?
                  <button type="button" onClick={excluir} className="font-medium text-brand-rosa">Excluir</button>
                  <button type="button" onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmarExclusao(true)} className="flex items-center gap-1 hover:text-brand-rosa"><Trash2 className="h-3.5 w-3.5" /> Excluir prévia</button>
              )}
            </div>
          </div>
        </aside>

        {/* Prévia */}
        <section className="flex min-h-[60vh] flex-1 flex-col bg-black/20">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2">
            <div className="flex gap-1">
              {([['desktop', Monitor], ['celular', Smartphone]] as const).map(([d, Icone]) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDispositivo(d)}
                  aria-label={d === 'desktop' ? 'Ver no computador' : 'Ver no celular'}
                  className={cn('rounded-md p-1.5 transition-colors', dispositivo === d ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/40 hover:text-brand-lavanda')}
                >
                  <Icone className="h-4 w-4" />
                </button>
              ))}
            </div>
            <span className="text-xs text-brand-lavanda/40">
              {ocupado === 'gerar' ? `Gerando… ${(tamanho / 1024).toFixed(0)} KB` : verVersao ? `Vendo a versão ${verVersao.numero}` : previa.html ? `Versão ${previa.versao_atual}` : ''}
            </span>
            {verVersao ? (
              <button type="button" onClick={() => setVerVersao(null)} className="text-xs text-brand-lima hover:underline">Voltar para a atual</button>
            ) : <span className="w-4" />}
          </div>

          <div className="flex min-h-0 flex-1 justify-center overflow-auto p-3">
            <div className={cn('h-full overflow-hidden rounded-lg border border-white/[0.08] bg-white shadow-2xl transition-all', dispositivo === 'celular' ? 'w-[390px]' : 'w-full')}>
              {verVersao || (ocupado === 'gerar' && parcial) ? (
                <iframe
                  title="Prévia"
                  sandbox="allow-scripts allow-popups allow-forms"
                  srcDoc={verVersao?.html ?? parcial}
                  className="h-full min-h-[60vh] w-full"
                />
              ) : previa.html && previa.status !== 'gerando' ? (
                <iframe
                  key={previa.versao_atual}
                  title="Prévia"
                  sandbox="allow-scripts allow-popups allow-forms"
                  src={`/p/${previa.slug}?admin=1&v=${previa.versao_atual}`}
                  className="h-full min-h-[60vh] w-full"
                />
              ) : (
                <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-2 bg-brand-noite text-center text-sm text-brand-lavanda/40">
                  {ocupado === 'gerar' || previa.status === 'gerando'
                    ? <><Loader2 className="h-5 w-5 animate-spin text-brand-lima" /> A IA está montando o site (1 a 3 minutos)…</>
                    : 'A prévia aparece aqui depois de gerar o site.'}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <Dialog open={briefingAberto} onOpenChange={setBriefingAberto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Briefing</DialogTitle></DialogHeader>
          {briefingEdit && <BriefingForm valor={briefingEdit} onChange={setBriefingEdit} pasta={id} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setBriefingAberto(false)}>Cancelar</Button>
            <Button onClick={salvarBriefing}>Salvar briefing</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

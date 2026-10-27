'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Copy, Download, ImagePlus, Loader2, Palette, Plus, Save, Sparkles, Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Arte } from '@/components/social/artes/arte'
import { TemaDialog } from '@/components/social/artes/tema-dialog'
import { baixarZip, exportarPngs, nomeArquivo, nomeLamina } from '@/components/social/artes/exportar'
import { createClient } from '@/lib/supabase/client'
import {
  ALTURA, ERRO_MIGRATION_ARTES, ICONES_INFO, LARGURA, TEMPLATES, TEMA_PADRAO, completarTema, novaLamina,
  type CampoArte, type DadosArte, type IconeInfo, type ItemInfo, type Lamina, type Tema, type TemplateArte,
} from '@/lib/social/artes'
import type { Post } from '@/lib/social/tipos'
import { cn } from '@/lib/utils'

const campo = 'h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-brand-lavanda outline-none'
const MINIATURA = 0.15

// Arte em escala: o nó de dentro continua com 1080 × 1350 (é ele que vira PNG).
function Escala({ escala, children }: { escala: number; children: React.ReactNode }) {
  return (
    <div style={{ width: LARGURA * escala, height: ALTURA * escala, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left', width: LARGURA, height: ALTURA }}>{children}</div>
    </div>
  )
}

// Editor das artes de um post: lâminas (template + dados), pré-visualização, geração das PNGs e ZIP.
export function ArtesEditor({ aberto, onClose, post, planejamentoId, clienteId, onSalvo }: {
  aberto: boolean
  onClose: () => void
  post: Post | null
  planejamentoId: string
  clienteId: string
  onSalvo: () => void
}) {
  const [laminas, setLaminas] = useState<Lamina[]>([])
  const [midias, setMidias] = useState<string[]>([])
  const [tema, setTema] = useState<Tema>(TEMA_PADRAO)
  const [sel, setSel] = useState(0)
  const [ocupado, setOcupado] = useState<null | 'salvar' | 'gerar' | 'zip' | 'foto'>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editarTema, setEditarTema] = useState(false)
  const [novoTemplate, setNovoTemplate] = useState<TemplateArte>('produto')
  const [escala, setEscala] = useState(0.4)
  const nos = useRef<(HTMLDivElement | null)[]>([])
  const palco = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto || !post) return
    setLaminas(structuredClone(post.artes ?? []))
    setMidias(post.midias)
    setSel(0)
    setErro(null)
    setAviso(null)
    ;(createClient() as any).from('social_temas').select('tema').eq('cliente_id', clienteId).maybeSingle()
      .then(({ data, error }: { data: { tema: Partial<Tema> } | null; error: { code?: string; message: string } | null }) => {
        if (error) setErro(error.code === '42P01' ? ERRO_MIGRATION_ARTES : error.message)
        setTema(completarTema(data?.tema))
      })
  }, [aberto, post, clienteId])

  // A pré-visualização ocupa o espaço disponível, mantendo 4:5.
  useEffect(() => {
    const el = palco.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setEscala(Math.max(0.2, Math.min(width / LARGURA, height / ALTURA)))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [aberto])

  if (!post) return null
  const atual = laminas[sel] as Lamina | undefined
  const sujo = JSON.stringify(laminas) !== JSON.stringify(post.artes ?? [])

  const mudarLaminas = (fn: (ls: Lamina[]) => Lamina[]) => { setLaminas((ls) => fn(structuredClone(ls))); setAviso(null) }
  const setDado = <K extends keyof DadosArte>(chave: K, valor: DadosArte[K]) =>
    mudarLaminas((ls) => { ls[sel].dados[chave] = valor; return ls })

  function mover(de: number, para: number) {
    if (para < 0 || para >= laminas.length) return
    mudarLaminas((ls) => { const [l] = ls.splice(de, 1); ls.splice(para, 0, l); return ls })
    setSel(para)
  }

  function trocarTemplate(t: TemplateArte) {
    mudarLaminas((ls) => { ls[sel] = { template: t, dados: { ...structuredClone(TEMPLATES[t].padrao), ...ls[sel].dados } }; return ls })
  }

  async function enviarFoto(f: File): Promise<string | null> {
    const supabase = createClient()
    const caminho = `${planejamentoId}/fotos/${crypto.randomUUID()}.${f.name.split('.').pop()?.toLowerCase() || 'jpg'}`
    const { error } = await supabase.storage.from('social').upload(caminho, f, { contentType: f.type })
    if (error) { setErro(error.message); return null }
    return supabase.storage.from('social').getPublicUrl(caminho).data.publicUrl
  }

  async function salvarDados(extra: Record<string, unknown> = {}) {
    const { error } = await (createClient() as any).from('social_posts')
      .update({ artes: laminas, updated_at: new Date().toISOString(), ...extra })
      .eq('id', post!.id)
    if (error) throw new Error(error.message.includes('artes') ? ERRO_MIGRATION_ARTES : error.message)
  }

  async function executar(tipo: 'salvar' | 'gerar' | 'zip', fn: () => Promise<string>) {
    setOcupado(tipo)
    setErro(null)
    setAviso(null)
    try {
      setAviso(await fn())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Algo deu errado.')
    } finally {
      setOcupado(null)
    }
  }

  const salvar = () => executar('salvar', async () => {
    await salvarDados()
    onSalvo()
    return 'Dados das lâminas salvos.'
  })

  // Gera as PNGs, sobe para o bucket e coloca no lugar das artes geradas antes
  // (as mídias enviadas à mão continuam, depois das artes).
  const gerar = () => executar('gerar', async () => {
    const blobs = await exportarPngs(nos.current.slice(0, laminas.length) as HTMLDivElement[])
    const supabase = createClient()
    const pasta = `${planejamentoId}/artes/${post.id}`
    const lote = Date.now()
    const novas: string[] = []
    for (const [i, blob] of blobs.entries()) {
      const caminho = `${pasta}/${lote}-${nomeLamina(i)}`
      const { error } = await supabase.storage.from('social').upload(caminho, blob, { contentType: 'image/png' })
      if (error) throw new Error(error.message)
      novas.push(supabase.storage.from('social').getPublicUrl(caminho).data.publicUrl)
    }
    const marca = `/social/${pasta}/`
    const antigas = midias.filter((u) => u.includes(marca))
    const lista = [...novas, ...midias.filter((u) => !u.includes(marca))]
    // Arte nova em post já respondido: volta a aguardar o cliente (igual ao editar post).
    await salvarDados({ midias: lista, ...(post.aprovacao !== 'pendente' && { aprovacao: 'pendente' }) })
    if (antigas.length) {
      await supabase.storage.from('social').remove(antigas.map((u) => decodeURIComponent(u.split('/object/public/social/')[1] ?? ''))).catch(() => null)
    }
    setMidias(lista)
    onSalvo()
    return `${novas.length} arte${novas.length > 1 ? 's' : ''} gerada${novas.length > 1 ? 's' : ''} e anexada${novas.length > 1 ? 's' : ''} ao post.`
  })

  const zip = () => executar('zip', async () => {
    const blobs = await exportarPngs(nos.current.slice(0, laminas.length) as HTMLDivElement[])
    await baixarZip(blobs, nomeArquivo(`${post.data} ${post.titulo}`))
    return 'ZIP baixado.'
  })

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !ocupado && onClose()}>
      <DialogContent className="flex h-[94dvh] max-w-[1280px] flex-col gap-0 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="border-b border-white/[0.06] px-5 py-4 pr-12 text-left">
          <DialogTitle className="truncate">Artes · {post.titulo}</DialogTitle>
          <DialogDescription>Cada lâmina é um template + dados. Gere de novo sempre que trocar uma foto, preço ou texto.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[190px_1fr_340px] md:overflow-hidden">
          {/* Miniaturas: também são os nós exportados em PNG. */}
          <aside className="flex gap-3 overflow-x-auto border-b border-white/[0.06] p-3 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r">
            {laminas.map((l, i) => (
              <button key={i} type="button" onClick={() => setSel(i)}
                className={cn('relative shrink-0 rounded-md p-1 text-left transition-colors', i === sel ? 'bg-brand-lima/15 ring-1 ring-brand-lima/60' : 'hover:bg-white/[0.04]')}>
                <Escala escala={MINIATURA}>
                  <Arte ref={(el) => { nos.current[i] = el }} tema={tema} laminas={laminas} indice={i} />
                </Escala>
                <span className="mt-1 block text-[11px] text-brand-lavanda/60">{i + 1}. {TEMPLATES[l.template].label}</span>
              </button>
            ))}
            <div className="flex shrink-0 flex-col gap-1.5 md:mt-1">
              <select value={novoTemplate} onChange={(e) => setNovoTemplate(e.target.value as TemplateArte)} className={cn(campo, 'h-8 text-xs')}>
                {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k} className="bg-brand-noite">{t.label}</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={() => { mudarLaminas((ls) => [...ls, novaLamina(novoTemplate)]); setSel(laminas.length) }}>
                <Plus className="h-3.5 w-3.5" /> Lâmina
              </Button>
            </div>
          </aside>

          {/* Pré-visualização grande da lâmina escolhida. */}
          <section className="flex min-h-[420px] min-w-0 flex-col items-center gap-3 p-4">
            <div ref={palco} className="flex min-h-0 w-full flex-1 items-center justify-center">
              {atual
                ? <div className="overflow-hidden rounded-lg shadow-2xl shadow-black/60"><Escala escala={escala}><Arte tema={tema} laminas={laminas} indice={sel} /></Escala></div>
                : <p className="text-sm text-brand-lavanda/40">Nenhuma lâmina ainda. Escolha um template e clique em “Lâmina”.</p>}
            </div>
            {atual && <p className="text-[11px] text-brand-lavanda/40">Lâmina {sel + 1} de {laminas.length} · 1080 × 1350</p>}
          </section>

          {/* Dados da lâmina. */}
          <aside className="space-y-4 border-t border-white/[0.06] p-4 md:overflow-y-auto md:border-l md:border-t-0">
            <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => setEditarTema(true)}>
              <Palette className="h-3.5 w-3.5" /> Tema da cliente
              <span className="ml-auto flex gap-0.5">{Object.values(tema.cores).map((c, i) => <span key={i} className="h-3 w-3 rounded-full border border-white/10" style={{ background: c }} />)}</span>
            </Button>

            {atual && (
              <>
                <div className="flex items-center gap-1">
                  <select value={atual.template} onChange={(e) => trocarTemplate(e.target.value as TemplateArte)} className={cn(campo, 'flex-1')} aria-label="Template">
                    {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k} className="bg-brand-noite">{t.label}</option>)}
                  </select>
                  <Button size="icon" variant="ghost" className="h-9 w-8" onClick={() => mover(sel, sel - 1)} disabled={sel === 0} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-9 w-8" onClick={() => mover(sel, sel + 1)} disabled={sel === laminas.length - 1} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-9 w-8" onClick={() => { mudarLaminas((ls) => { ls.splice(sel + 1, 0, structuredClone(ls[sel])); return ls }); setSel(sel + 1) }} aria-label="Duplicar"><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-9 w-8 hover:text-brand-rosa" onClick={() => { mudarLaminas((ls) => { ls.splice(sel, 1); return ls }); setSel(Math.max(0, sel - 1)) }} aria-label="Remover lâmina"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <p className="text-[11px] text-brand-lavanda/40">{TEMPLATES[atual.template].descricao}</p>

                {TEMPLATES[atual.template].campos.map((c) => (
                  <CampoLamina key={`${sel}-${c.chave}`} campo={c} dados={atual.dados} setDado={setDado}
                    enviarFoto={async (f) => { setOcupado('foto'); const u = await enviarFoto(f); setOcupado(null); return u }} />
                ))}
              </>
            )}
          </aside>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-5 py-3">
          <div className="min-w-0 flex-1 text-xs">
            {erro ? <span className="text-brand-rosa">{erro}</span>
              : aviso ? <span className="text-brand-lima">{aviso}</span>
              : sujo ? <span className="text-yellow-400">Alterações não salvas</span>
              : <span className="text-brand-lavanda/40">{midias.length} mídia{midias.length === 1 ? '' : 's'} no post</span>}
          </div>
          <Button size="sm" variant="ghost" onClick={salvar} disabled={!!ocupado || !sujo}>
            {ocupado === 'salvar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar dados
          </Button>
          <Button size="sm" variant="outline" onClick={zip} disabled={!!ocupado || !laminas.length}>
            {ocupado === 'zip' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Baixar ZIP
          </Button>
          <Button size="sm" onClick={gerar} disabled={!!ocupado || !laminas.length}>
            {ocupado === 'gerar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Gerar artes
          </Button>
        </footer>
      </DialogContent>

      <TemaDialog aberto={editarTema} onClose={() => setEditarTema(false)} clienteId={clienteId} tema={tema} onSalvo={setTema} />
    </Dialog>
  )
}

function CampoLamina({ campo: c, dados, setDado, enviarFoto }: {
  campo: CampoArte
  dados: DadosArte
  setDado: <K extends keyof DadosArte>(chave: K, valor: DadosArte[K]) => void
  enviarFoto: (f: File) => Promise<string | null>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const valor = dados[c.chave]

  async function escolher(arquivos: FileList | null) {
    if (!arquivos?.length) return
    setEnviando(true)
    const urls: string[] = []
    for (const f of Array.from(arquivos)) { const u = await enviarFoto(f); if (u) urls.push(u) }
    setEnviando(false)
    if (input.current) input.current.value = ''
    if (!urls.length) return
    if (c.tipo === 'fotos') setDado('fotos', [...(dados.fotos ?? []), ...urls].slice(0, 4))
    else setDado(c.chave, urls[0] as never)
  }

  const botaoFoto = (
    <>
      <button type="button" onClick={() => input.current?.click()} disabled={enviando}
        className="flex h-20 w-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white/[0.15] text-[10px] text-brand-lavanda/50 hover:border-brand-lima/40 hover:text-brand-lima">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {enviando ? 'Enviando' : 'Foto'}
      </button>
      <input ref={input} type="file" accept="image/*" multiple={c.tipo === 'fotos'} hidden onChange={(e) => escolher(e.target.files)} />
    </>
  )
  const miniatura = (url: string, remover: () => void) => (
    <div key={url} className="relative h-20 w-16 overflow-hidden rounded-md border border-white/[0.1] bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      <button type="button" onClick={remover} aria-label="Remover foto" className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-brand-rosa"><X className="h-3 w-3" /></button>
    </div>
  )

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{c.rotulo}</Label>
      {c.tipo === 'texto' && <Input value={(valor as string) ?? ''} onChange={(e) => setDado(c.chave, e.target.value as never)} />}
      {c.tipo === 'texto_longo' && <Textarea rows={2} value={(valor as string) ?? ''} onChange={(e) => setDado(c.chave, e.target.value as never)} className="min-h-0" />}
      {c.tipo === 'opcoes' && (
        <select value={(valor as string) ?? ''} onChange={(e) => setDado(c.chave, e.target.value as never)} className={campo}>
          {c.opcoes!.map(([v, l]) => <option key={v} value={v} className="bg-brand-noite">{l}</option>)}
        </select>
      )}
      {c.tipo === 'foto' && (
        <div className="flex gap-2">
          {typeof valor === 'string' && valor ? miniatura(valor, () => setDado(c.chave, '' as never)) : botaoFoto}
        </div>
      )}
      {c.tipo === 'fotos' && (
        <div className="flex flex-wrap gap-2">
          {(dados.fotos ?? []).map((u) => miniatura(u, () => setDado('fotos', (dados.fotos ?? []).filter((x) => x !== u))))}
          {(dados.fotos?.length ?? 0) < 4 && botaoFoto}
        </div>
      )}
      {c.tipo === 'itens' && <Itens itens={dados.itens ?? []} onChange={(v) => setDado('itens', v)} />}
      {c.ajuda && <p className="text-[11px] text-brand-lavanda/40">{c.ajuda}</p>}
    </div>
  )
}

function Itens({ itens, onChange }: { itens: ItemInfo[]; onChange: (v: ItemInfo[]) => void }) {
  const mudar = (i: number, item: Partial<ItemInfo>) => onChange(itens.map((x, k) => (k === i ? { ...x, ...item } : x)))
  return (
    <div className="space-y-2">
      {itens.map((item, i) => (
        <div key={i} className="flex gap-1.5">
          <select value={item.icone} onChange={(e) => mudar(i, { icone: e.target.value as IconeInfo })} className={cn(campo, 'w-28 shrink-0')} aria-label="Ícone">
            {Object.entries(ICONES_INFO).map(([k, l]) => <option key={k} value={k} className="bg-brand-noite">{l}</option>)}
          </select>
          <Input value={item.texto} onChange={(e) => mudar(i, { texto: e.target.value })} />
          <Button size="icon" variant="ghost" className="h-9 w-8 shrink-0" onClick={() => onChange(itens.filter((_, k) => k !== i))} aria-label="Remover linha"><X className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      {itens.length < 4 && <Button size="sm" variant="outline" onClick={() => onChange([...itens, { icone: 'local', texto: '' }])}><Plus className="h-3.5 w-3.5" /> Linha</Button>}
    </div>
  )
}

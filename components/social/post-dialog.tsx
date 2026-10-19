'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Copy, Loader2, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ehVideo } from '@/components/social/post-card'
import { createClient } from '@/lib/supabase/client'
import { APROVACAO, FORMATOS, POST_VAZIO, PRODUCAO, REDES, fimDoPeriodo, type Formato, type Post, type Producao, type Rede } from '@/lib/social/tipos'
import { cn } from '@/lib/utils'

type Form = typeof POST_VAZIO & { data: string }

const LIMITE_LEGENDA = 2200 // Instagram

const campo = 'h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-brand-lavanda outline-none'

// Cria ou edita um post. `post` nulo + `data` = post novo naquele dia.
export function PostDialog({ aberto, onClose, planejamentoId, post, data, mes, fim, onSalvo }: {
  aberto: boolean
  onClose: () => void
  planejamentoId: string
  post: Post | null
  data: string | null
  mes: string
  fim: string | null
  onSalvo: () => void
}) {
  const [form, setForm] = useState<Form>({ ...POST_VAZIO, data: mes })
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!aberto) return
    setErro(null)
    setConfirmarExclusao(false)
    setForm(post
      ? {
          data: post.data, horario: post.horario ?? '', redes: post.redes, formato: post.formato, titulo: post.titulo,
          legenda: post.legenda ?? '', hashtags: post.hashtags ?? '', roteiro: post.roteiro ?? '', cta: post.cta ?? '',
          midias: post.midias ?? [], producao: post.producao,
        }
      : { ...POST_VAZIO, data: data ?? mes })
  }, [aberto, post, data, mes])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  async function enviarArquivos(arquivos: FileList | null) {
    if (!arquivos?.length) return
    setEnviando(true)
    setErro(null)
    const supabase = createClient()
    const novas: string[] = []
    for (const f of Array.from(arquivos)) {
      if (f.size > 50 * 1024 * 1024) { setErro(`${f.name} passa de 50 MB.`); continue }
      const ext = f.name.split('.').pop()?.toLowerCase() || 'png'
      const caminho = `${planejamentoId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('social').upload(caminho, f, { contentType: f.type })
      if (error) { setErro(error.message); continue }
      novas.push(supabase.storage.from('social').getPublicUrl(caminho).data.publicUrl)
    }
    setForm((f) => ({ ...f, midias: [...f.midias, ...novas].slice(0, 20) }))
    setEnviando(false)
    if (input.current) input.current.value = ''
  }

  function moverMidia(i: number) {
    if (i === 0) return
    const m = [...form.midias]
    ;[m[i - 1], m[i]] = [m[i], m[i - 1]]
    set('midias', m)
  }

  async function salvar(duplicar = false) {
    if (!form.titulo.trim()) { setErro('Dê um tema para o post.'); return }
    if (!form.redes.length) { setErro('Escolha ao menos uma rede.'); return }
    setSalvando(true)
    setErro(null)
    const db = createClient() as any
    const linha = {
      data: form.data,
      horario: form.horario || null,
      redes: form.redes,
      formato: form.formato,
      titulo: form.titulo.trim(),
      legenda: form.legenda.trim() || null,
      hashtags: form.hashtags.trim() || null,
      roteiro: form.roteiro.trim() || null,
      cta: form.cta.trim() || null,
      midias: form.midias,
      producao: form.producao,
      updated_at: new Date().toISOString(),
    }
    // Mudou o conteúdo de um post que o cliente já respondeu: volta a aguardar.
    const conteudoMudou = post && (['titulo', 'legenda', 'hashtags', 'roteiro', 'cta', 'data', 'formato'] as const)
      .some((k) => (post[k] ?? null) !== linha[k]) || (post && JSON.stringify(post.midias) !== JSON.stringify(linha.midias))
    const { error } = duplicar || !post
      ? await db.from('social_posts').insert({ ...linha, planejamento_id: planejamentoId, ...(duplicar && { titulo: `${linha.titulo} (cópia)` }) })
      : await db.from('social_posts').update({
          ...linha,
          ...(conteudoMudou && post.aprovacao !== 'pendente' && { aprovacao: 'pendente' }),
        }).eq('id', post.id)
    setSalvando(false)
    if (error) { setErro(error.message); return }
    onSalvo()
    onClose()
  }

  async function excluir() {
    if (!post) return
    const { error } = await (createClient() as any).from('social_posts').delete().eq('id', post.id)
    if (error) { setErro(error.message); return }
    onSalvo()
    onClose()
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{post ? 'Editar post' : 'Novo post'}</DialogTitle></DialogHeader>

        {post && post.aprovacao !== 'pendente' && (
          <p className={cn('rounded-lg px-3 py-2 text-xs', post.aprovacao === 'aprovado' ? 'bg-brand-lima/[0.07] text-brand-lima' : 'bg-brand-rosa/[0.07] text-brand-rosa')}>
            {APROVACAO[post.aprovacao].label} pelo cliente{post.comentario_cliente && `: "${post.comentario_cliente}"`}. Se você mudar o conteúdo, o post volta a aguardar aprovação.
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={form.data} min={mes} max={fimDoPeriodo(mes, fim)} onChange={(e) => set('data', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Horário</Label>
            <Input type="time" value={form.horario} onChange={(e) => set('horario', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Produção</Label>
            <select value={form.producao} onChange={(e) => set('producao', e.target.value as Producao)} className={campo}>
              {Object.entries(PRODUCAO).map(([k, v]) => <option key={k} value={k} className="bg-brand-noite">{v.label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Formato</Label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(FORMATOS).map(([k, f]) => (
              <button
                key={k}
                type="button"
                onClick={() => set('formato', k as Formato)}
                className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors', form.formato === k ? 'border-brand-lima/50 bg-brand-lima/10 text-brand-lima' : 'border-white/[0.1] text-brand-lavanda/60 hover:text-brand-lavanda')}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: f.cor }} /> {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Redes</Label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(REDES).map(([k, r]) => {
              const ativa = form.redes.includes(k as Rede)
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => set('redes', ativa ? form.redes.filter((x) => x !== k) : [...form.redes, k as Rede])}
                  className={cn('rounded-full border px-3 py-1 text-xs transition-colors', ativa ? 'border-transparent text-white' : 'border-white/[0.1] text-brand-lavanda/50 hover:text-brand-lavanda')}
                  style={ativa ? { background: r.cor } : undefined}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Tema / pauta *</Label>
          <Input value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: 3 erros que fazem seu pão murchar" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-end justify-between">
            <Label>Legenda</Label>
            <span className={cn('text-[11px]', form.legenda.length > LIMITE_LEGENDA ? 'text-brand-rosa' : 'text-brand-lavanda/30')}>{form.legenda.length}/{LIMITE_LEGENDA}</span>
          </div>
          <Textarea rows={7} value={form.legenda} onChange={(e) => set('legenda', e.target.value)} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Hashtags</Label>
            <Textarea rows={2} value={form.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#padaria #paofrances" />
          </div>
          <div className="space-y-1.5">
            <Label>Chamada para ação (CTA)</Label>
            <Textarea rows={2} value={form.cta} onChange={(e) => set('cta', e.target.value)} placeholder="Peça pelo link da bio" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{form.formato === 'reels' || form.formato === 'video' ? 'Roteiro do vídeo' : form.formato === 'carrossel' ? 'Texto dos slides' : 'Briefing da arte'}</Label>
          <Textarea rows={4} value={form.roteiro} onChange={(e) => set('roteiro', e.target.value)} placeholder={form.formato === 'carrossel' ? 'Slide 1: ...\nSlide 2: ...' : 'O que vai na arte / no vídeo'} />
        </div>

        <div className="space-y-1.5">
          <Label>Artes e vídeos</Label>
          <div className="flex flex-wrap gap-2">
            {form.midias.map((url, i) => (
              <div key={url} className="group relative h-24 w-20 overflow-hidden rounded-lg border border-white/[0.1] bg-black">
                {ehVideo(url)
                  ? <video src={url} muted className="h-full w-full object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={url} alt="" className="h-full w-full object-cover" />}
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">{i + 1}</span>
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 p-0.5 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
                  <button type="button" onClick={() => moverMidia(i)} disabled={i === 0} aria-label="Mover para a esquerda" className="p-0.5 text-white disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => set('midias', form.midias.filter((u) => u !== url))} aria-label="Remover" className="p-0.5 text-brand-rosa"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={enviando}
              className="flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/[0.15] text-[11px] text-brand-lavanda/50 hover:border-brand-lima/40 hover:text-brand-lima"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {enviando ? 'Enviando' : 'Enviar'}
            </button>
            <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => enviarArquivos(e.target.files)} />
          </div>
          <p className="text-[11px] text-brand-lavanda/30">Imagens ou vídeos (até 50 MB cada). A ordem é a do carrossel.</p>
        </div>

        {erro && <p className="text-sm text-brand-rosa">{erro}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
          {post && (
            confirmarExclusao ? (
              <span className="flex items-center gap-2 text-xs text-brand-lavanda/60">
                Excluir este post?
                <button type="button" onClick={excluir} className="font-medium text-brand-rosa">Excluir</button>
                <button type="button" onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
              </span>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setConfirmarExclusao(true)} className="text-brand-lavanda/50 hover:text-brand-rosa"><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
                <Button variant="ghost" size="sm" onClick={() => salvar(true)} disabled={salvando || enviando}><Copy className="h-3.5 w-3.5" /> Duplicar</Button>
              </>
            )
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={() => salvar()} disabled={salvando || enviando}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

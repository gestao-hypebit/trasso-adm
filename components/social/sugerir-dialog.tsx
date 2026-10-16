'use client'

import { useState } from 'react'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { FORMATOS, REDES, type Pauta } from '@/lib/social/tipos'
import { cn, formatDate } from '@/lib/utils'

type Sugestao = Pauta['posts'][number]

// Pede uma pauta para a IA e deixa escolher quais posts entram no calendário.
export function SugerirDialog({ aberto, onClose, planejamentoId, onAdicionados }: {
  aberto: boolean
  onClose: () => void
  planejamentoId: string
  onAdicionados: () => void
}) {
  const [quantidade, setQuantidade] = useState(12)
  const [formatos, setFormatos] = useState<string[]>(['feed', 'carrossel', 'reels', 'stories'])
  const [redes, setRedes] = useState<string[]>(['instagram'])
  const [contexto, setContexto] = useState('')
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null)
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set())
  const [ocupado, setOcupado] = useState<null | 'gerar' | 'salvar'>(null)
  const [erro, setErro] = useState<string | null>(null)

  const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])

  async function gerar() {
    setOcupado('gerar')
    setErro(null)
    try {
      const res = await fetch(`/api/social/${planejamentoId}/sugerir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantidade, formatos, redes, contexto }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setSugestoes(json.posts)
      setEscolhidos(new Set(json.posts.map((_: Sugestao, i: number) => i)))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar a pauta.')
    }
    setOcupado(null)
  }

  async function adicionar() {
    if (!sugestoes) return
    setOcupado('salvar')
    const linhas = sugestoes
      .filter((_, i) => escolhidos.has(i))
      .map((s) => ({
        planejamento_id: planejamentoId, data: s.data, horario: s.horario || null, formato: s.formato, redes,
        titulo: s.titulo, legenda: s.legenda || null, hashtags: s.hashtags || null, roteiro: s.roteiro || null, cta: s.cta || null,
      }))
    const { error } = await (createClient() as any).from('social_posts').insert(linhas)
    setOcupado(null)
    if (error) { setErro(error.message); return }
    setSugestoes(null)
    onAdicionados()
    onClose()
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !ocupado && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sugerir pauta com IA</DialogTitle>
          <DialogDescription>A IA usa os dados do cliente e o objetivo do mês. Você escolhe o que entra e edita depois.</DialogDescription>
        </DialogHeader>

        {!sugestoes ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[120px_1fr]">
              <div className="space-y-1.5">
                <Label>Quantos posts</Label>
                <Input type="number" min={1} max={31} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Redes</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(REDES).map(([k, r]) => (
                    <button key={k} type="button" onClick={() => setRedes(alternar(redes, k))}
                      className={cn('rounded-full border px-3 py-1 text-xs', redes.includes(k) ? 'border-transparent text-white' : 'border-white/[0.1] text-brand-lavanda/50')}
                      style={redes.includes(k) ? { background: r.cor } : undefined}>{r.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Formatos</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(FORMATOS).map(([k, f]) => (
                  <button key={k} type="button" onClick={() => setFormatos(alternar(formatos, k))}
                    className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs', formatos.includes(k) ? 'border-brand-lima/50 bg-brand-lima/10 text-brand-lima' : 'border-white/[0.1] text-brand-lavanda/50')}>
                    <span className="h-2 w-2 rounded-full" style={{ background: f.cor }} /> {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Orientações (opcional)</Label>
              <Textarea rows={4} value={contexto} onChange={(e) => setContexto(e.target.value)}
                placeholder="Ex.: tom descontraído; promoção de 20% no dia 15; foco em delivery; evitar falar de preço; público de 25 a 40 anos" />
            </div>
            {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={!!ocupado}>Cancelar</Button>
              <Button onClick={gerar} disabled={!!ocupado || !formatos.length || !redes.length}>
                {ocupado === 'gerar' ? <><Loader2 className="h-4 w-4 animate-spin" /> Montando a pauta… (até 2 min)</> : <><Wand2 className="h-4 w-4" /> Gerar pauta</>}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-brand-lavanda/50">
              <span>{escolhidos.size} de {sugestoes.length} selecionados</span>
              <button type="button" className="hover:text-brand-lavanda" onClick={() => setEscolhidos(escolhidos.size === sugestoes.length ? new Set() : new Set(sugestoes.map((_, i) => i)))}>
                {escolhidos.size === sugestoes.length ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>
            <ul className="space-y-2">
              {sugestoes.map((s, i) => (
                <li key={i}>
                  <label className={cn('flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors', escolhidos.has(i) ? 'border-brand-lima/30 bg-brand-lima/[0.04]' : 'border-white/[0.06] opacity-60')}>
                    <input type="checkbox" className="mt-1 accent-[#B8F000]" checked={escolhidos.has(i)}
                      onChange={() => { const n = new Set(escolhidos); if (n.has(i)) n.delete(i); else n.add(i); setEscolhidos(n) }} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-brand-lavanda/50">
                        <span className="capitalize">{formatDate(s.data, 'EEE, dd/MM')} · {s.horario}</span>
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-brand-noite" style={{ background: FORMATOS[s.formato].cor }}>{FORMATOS[s.formato].label}</span>
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-brand-lavanda">{s.titulo}</p>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-brand-lavanda/60">{s.legenda}</p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-white/[0.06] bg-brand-noite/95 py-3 backdrop-blur">
              <Button variant="ghost" onClick={() => setSugestoes(null)} disabled={!!ocupado}>Gerar de novo</Button>
              <Button onClick={adicionar} disabled={!!ocupado || !escolhidos.size}>
                {ocupado === 'salvar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Adicionar {escolhidos.size} ao calendário
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

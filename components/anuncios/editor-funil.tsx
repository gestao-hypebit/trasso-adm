'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EVENTOS_ENTREGA, EVENTOS_PADRAO, EVENTOS_PRODUTO, rotuloEvento, type Etapa } from '@/lib/anuncios/funil'
import { createClient } from '@/lib/supabase/client'

const OUTRA_ACAO = 'acao:'

// Etapas do funil de uma marca, em ordem. `eventosPixel` = eventos que os
// pixels já registraram (inclui personalizados).
export function EditorFunil({ marcaId, inicial, eventosPixel }: { marcaId: string; inicial: Etapa[]; eventosPixel: string[] }) {
  const [etapas, setEtapas] = useState<Etapa[]>(inicial)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const pixel = [...new Set([...EVENTOS_PADRAO, ...eventosPixel])]
  const alterado = JSON.stringify(etapas) !== JSON.stringify(inicial)

  const mudar = (i: number, p: Partial<Etapa>) => setEtapas((l) => l.map((e, j) => (j === i ? { ...e, ...p } : e)))
  const mover = (i: number, d: -1 | 1) => setEtapas((l) => {
    const n = [...l]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    return n
  })

  async function salvar() {
    const limpas = etapas
      .map((e) => ({ rotulo: e.rotulo.trim() || rotuloEvento(e.evento), evento: e.evento.trim(), ...(e.lateral ? { lateral: true } : {}) }))
      .filter((e) => e.evento && e.evento !== OUTRA_ACAO)
    setSalvando(true)
    const { error } = await (createClient() as any).from('anuncio_marcas').update({ funil: limpas }).eq('id', marcaId)
    setSalvando(false)
    if (error) return setMsg('Não foi possível salvar o funil.')
    setEtapas(limpas)
    setMsg('Funil salvo.')
  }

  return (
    <div className="mt-4 border-t border-white/[0.06] pt-4">
      <p className="mb-1 text-xs font-medium text-brand-lavanda/70">Etapas do funil</p>
      <p className="mb-3 text-[11px] text-brand-lavanda/40">
        De cima para baixo. “Lateral” = saída alternativa (ex.: clicou no WhatsApp): mostra a taxa sobre a etapa anterior, mas não vira o passo seguinte.
      </p>
      <div className="space-y-2">
        {etapas.map((e, i) => {
          const avancado = e.evento.startsWith(OUTRA_ACAO)
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-5 text-right text-xs text-brand-lavanda/30">{i + 1}</span>
              <Input className="h-8 w-[180px]" value={e.rotulo} placeholder={rotuloEvento(e.evento)} onChange={(x) => mudar(i, { rotulo: x.target.value })} />
              <Select value={avancado ? OUTRA_ACAO : e.evento} onValueChange={(v) => mudar(i, { evento: v })}>
                <SelectTrigger className="h-8 w-[210px]"><SelectValue placeholder="Evento" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Entrega do anúncio</SelectLabel>
                    {EVENTOS_ENTREGA.map((o) => <SelectItem key={o.evento} value={o.evento}>{o.rotulo}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Pixel</SelectLabel>
                    {pixel.map((p) => <SelectItem key={p} value={`pixel:${p}`}>{p}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Produto (real)</SelectLabel>
                    {EVENTOS_PRODUTO.map((o) => <SelectItem key={o.evento} value={o.evento}>{o.rotulo}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Avançado</SelectLabel>
                    <SelectItem value={OUTRA_ACAO}>Ação do Meta (action_type)…</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {avancado && (
                <Input className="h-8 w-[240px]" placeholder="ex.: offsite_conversion.custom.123" value={e.evento.slice(OUTRA_ACAO.length)}
                  onChange={(x) => mudar(i, { evento: `${OUTRA_ACAO}${x.target.value.trim()}` })} />
              )}
              <label className="flex items-center gap-1.5 text-xs text-brand-lavanda/60">
                <input type="checkbox" checked={!!e.lateral} onChange={(x) => mudar(i, { lateral: x.target.checked })} /> Lateral
              </label>
              <div className="flex">
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === etapas.length - 1} onClick={() => mover(i, 1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEtapas((l) => l.filter((_, j) => j !== i))} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setEtapas((l) => [...l, { rotulo: '', evento: 'pixel:PageView' }])}>
          <Plus className="h-3.5 w-3.5" />Etapa
        </Button>
        <Button size="sm" onClick={salvar} disabled={!alterado || salvando}>Salvar funil</Button>
        {msg && <span className="text-xs text-brand-lavanda/60">{msg}</span>}
      </div>
    </div>
  )
}

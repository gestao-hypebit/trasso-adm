'use client'

import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CORES_META, DIAS_SEMANA, type MetaDiaria } from '@/lib/metas/diarias'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Nulo = nova meta.
  meta: MetaDiaria | null
  proximaOrdem: number
  onSalvo: () => void
}

const vazio = { titulo: '', alvo: '', unidade: '', dias_semana: [1, 2, 3, 4, 5], cor: CORES_META[0] }

export function MetaDiariaDialog({ open, onOpenChange, meta, proximaOrdem, onSalvo }: Props) {
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErro(null)
    setForm(meta
      ? { titulo: meta.titulo, alvo: String(meta.alvo), unidade: meta.unidade, dias_semana: meta.dias_semana, cor: meta.cor }
      : vazio)
  }, [open, meta])

  function alternarDia(d: number) {
    setForm((f) => ({
      ...f,
      dias_semana: f.dias_semana.includes(d) ? f.dias_semana.filter((x) => x !== d) : [...f.dias_semana, d].sort(),
    }))
  }

  async function salvar() {
    const alvo = parseInt(form.alvo, 10)
    if (!form.titulo.trim()) { setErro('Dê um nome para a meta.'); return }
    if (!alvo || alvo < 1) { setErro('O alvo por dia precisa ser pelo menos 1.'); return }
    if (form.dias_semana.length === 0) { setErro('Escolha pelo menos um dia da semana.'); return }
    setSalvando(true)
    setErro(null)
    const row = {
      titulo: form.titulo.trim(),
      alvo,
      unidade: form.unidade.trim() || 'vezes',
      dias_semana: form.dias_semana,
      cor: form.cor,
      updated_at: new Date().toISOString(),
    }
    const db = createClient() as any
    const { error } = meta
      ? await db.from('metas_diarias').update(row).eq('id', meta.id)
      : await db.from('metas_diarias').insert({ ...row, ordem: proximaOrdem })
    setSalvando(false)
    if (error) { setErro(error.message); return }
    onSalvo()
    onOpenChange(false)
  }

  async function alternarArquivada() {
    if (!meta) return
    setSalvando(true)
    const db = createClient() as any
    const { error } = await db.from('metas_diarias').update({ ativa: !meta.ativa, updated_at: new Date().toISOString() }).eq('id', meta.id)
    setSalvando(false)
    if (error) { setErro(error.message); return }
    onSalvo()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{meta ? 'Editar meta diária' : 'Nova meta diária'}</DialogTitle>
          <p className="text-xs text-brand-lavanda/50">Algo que você precisa fazer todo dia, com uma quantidade.</p>
        </DialogHeader>

        <div className="space-y-4 mt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">O que fazer</Label>
            <Input
              autoFocus placeholder="Ex: Oferecer o Catálogo Place" value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Quantos por dia</Label>
              <Input
                type="number" min={1} placeholder="40" value={form.alvo} className="text-lg font-bold h-11"
                onChange={(e) => setForm((f) => ({ ...f, alvo: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contando o quê</Label>
              <Input
                placeholder="mensagens" value={form.unidade} className="h-11"
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Em quais dias vale</Label>
            <div className="flex gap-1.5">
              {DIAS_SEMANA.map((d) => {
                const ativo = form.dias_semana.includes(d.value)
                return (
                  <button
                    key={d.value} type="button" onClick={() => alternarDia(d.value)}
                    className={cn(
                      'flex-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                      ativo ? 'border-white/[0.2] bg-white/[0.08] text-brand-lavanda' : 'border-white/[0.08] text-brand-lavanda/40 hover:text-brand-lavanda/70',
                    )}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cor</Label>
            <div className="flex gap-2">
              {CORES_META.map((c) => (
                <button
                  key={c} type="button" onClick={() => setForm((f) => ({ ...f, cor: c }))} title={c}
                  className={cn('h-7 w-7 rounded-full border-2 transition-transform hover:scale-110', form.cor === c ? 'border-brand-lavanda scale-110' : 'border-transparent')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {erro && <p className="text-xs text-brand-rosa">{erro}</p>}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
            {meta && (
              <Button variant="ghost" size="sm" onClick={alternarArquivada} disabled={salvando} className="gap-1.5 sm:mr-auto">
                {meta.ativa ? <><Archive className="h-3.5 w-3.5" /> Arquivar</> : <><ArchiveRestore className="h-3.5 w-3.5" /> Reativar</>}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:ml-auto">Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

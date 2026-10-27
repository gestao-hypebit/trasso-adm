'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { CORES_TEMA, ERRO_MIGRATION_ARTES, type Tema } from '@/lib/social/artes'

const HEX_RE = /^#[0-9a-f]{6}$/i

// Tema visual da cliente (social_temas). Vale para todos os planejamentos dela.
export function TemaDialog({ aberto, onClose, clienteId, tema, onSalvo }: {
  aberto: boolean
  onClose: () => void
  clienteId: string
  tema: Tema
  onSalvo: (t: Tema) => void
}) {
  const [form, setForm] = useState(tema)
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { if (aberto) { setForm(tema); setErro(null) } }, [aberto, tema])

  async function enviarLogo(f: File | undefined) {
    if (!f) return
    setEnviando(true)
    const supabase = createClient()
    const caminho = `temas/${clienteId}/${crypto.randomUUID()}.${f.name.split('.').pop()?.toLowerCase() || 'png'}`
    const { error } = await supabase.storage.from('social').upload(caminho, f, { contentType: f.type })
    setEnviando(false)
    if (input.current) input.current.value = ''
    if (error) { setErro(error.message); return }
    setForm((t) => ({ ...t, logoUrl: supabase.storage.from('social').getPublicUrl(caminho).data.publicUrl }))
  }

  async function salvar() {
    if (Object.values(form.cores).some((c) => !HEX_RE.test(c))) { setErro('Use cores no formato #RRGGBB.'); return }
    setSalvando(true)
    setErro(null)
    const { error } = await (createClient() as any).from('social_temas')
      .upsert({ cliente_id: clienteId, tema: form, updated_at: new Date().toISOString() })
    setSalvando(false)
    if (error) { setErro(error.code === '42P01' ? ERRO_MIGRATION_ARTES : error.message); return }
    onSalvo(form)
    onClose()
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tema da cliente</DialogTitle>
          <DialogDescription>Cores, logo e rodapé usados em todas as artes desta cliente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CORES_TEMA.map(({ chave, rotulo }) => (
              <div key={chave} className="space-y-1">
                <Label className="text-xs">{rotulo}</Label>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={HEX_RE.test(form.cores[chave]) ? form.cores[chave] : '#000000'} aria-label={rotulo}
                    onChange={(e) => setForm({ ...form, cores: { ...form.cores, [chave]: e.target.value.toUpperCase() } })}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded border border-white/[0.1] bg-transparent" />
                  <Input value={form.cores[chave]} onChange={(e) => setForm({ ...form, cores: { ...form.cores, [chave]: e.target.value.trim() } })} className="font-mono text-xs" />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                <div className="relative flex h-14 w-24 items-center justify-center rounded-lg border border-white/[0.1] p-1" style={{ background: form.cores.fundo }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                  <button type="button" onClick={() => setForm({ ...form, logoUrl: null })} aria-label="Remover logo" className="absolute -right-1.5 -top-1.5 rounded-full bg-brand-noite p-0.5 text-brand-rosa"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <Input className="w-32" value={form.logoTexto} onChange={(e) => setForm({ ...form, logoTexto: e.target.value })} aria-label="Texto no lugar da logo" />
              )}
              <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={enviando}>
                {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {form.logoUrl ? 'Trocar' : 'Enviar logo'}
              </Button>
              <input ref={input} type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" hidden onChange={(e) => enviarLogo(e.target.files?.[0])} />
            </div>
            <p className="text-[11px] text-brand-lavanda/40">{form.logoUrl ? 'PNG com fundo transparente fica melhor.' : 'Sem logo, as artes mostram este texto no lugar.'}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Rodapé</Label>
            <Input value={form.rodape} onChange={(e) => setForm({ ...form, rodape: e.target.value })} placeholder="@perfil · Cidade · WhatsApp (00) 00000-0000" />
          </div>

          {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || enviando}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar tema</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

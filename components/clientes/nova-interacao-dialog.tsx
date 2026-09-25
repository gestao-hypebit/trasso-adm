'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'

export type Interacao = {
  id: string; tipo: string; titulo: string; descricao: string | null; data: string; proximo_contato: string | null
}

export const tipoInteracaoLabel: Record<string, string> = {
  reuniao: 'Reunião', whatsapp: 'WhatsApp', ligacao: 'Ligação', email: 'E-mail', nota: 'Nota', outro: 'Outro',
}

function agoraLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

interface Props {
  clienteId: string
  clienteNome?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (interacao: Interacao) => void
}

export function NovaInteracaoDialog({ clienteId, clienteNome, open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState({ tipo: 'reuniao', titulo: '', descricao: '', data: '', proximo_contato: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm({ tipo: 'reuniao', titulo: '', descricao: '', data: agoraLocal(), proximo_contato: '' })
      setErro(null)
    }
  }, [open])

  async function handleSalvar() {
    if (!form.titulo.trim()) return
    setSalvando(true)
    const supabase = createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('interacoes')
      .insert({
        cliente_id: clienteId,
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        data: form.data ? new Date(form.data).toISOString() : new Date().toISOString(),
        proximo_contato: form.proximo_contato ? new Date(`${form.proximo_contato}T09:00`).toISOString() : null,
        responsavel_id: user?.id ?? null,
      })
      .select('id, tipo, titulo, descricao, data, proximo_contato')
      .single()
    setSalvando(false)
    if (error || !data) { setErro(error?.message ?? 'Erro ao salvar.'); return }
    onCreated?.(data as Interacao)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova interação</DialogTitle>
          {clienteNome && <DialogDescription>{clienteNome}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoInteracaoLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interacaoData">Data</Label>
              <Input id="interacaoData" type="datetime-local" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interacaoTitulo">Título</Label>
            <Input
              id="interacaoTitulo"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex: Reunião de alinhamento"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interacaoDescricao">Descrição (opcional)</Label>
            <Textarea
              id="interacaoDescricao"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="O que foi conversado, próximos passos..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interacaoProximo">Próximo contato (opcional)</Label>
            <Input id="interacaoProximo" type="date" value={form.proximo_contato} onChange={(e) => setForm((f) => ({ ...f, proximo_contato: e.target.value }))} />
          </div>
          {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando || !form.titulo.trim()}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar interação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

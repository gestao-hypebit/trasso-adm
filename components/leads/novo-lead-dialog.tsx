'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { origemOpcoes } from '@/lib/crm/opcoes'
import { LEAD_SELECT, type Lead } from '@/components/leads/lead-detalhe-dialog'

const VAZIO = { nome: '', telefone: '', email: '', empresa: '', origem: 'whatsapp', valor_estimado: '', observacoes: '' }

// Lead que chegou fora do site: WhatsApp, indicação, Instagram, evento...
export function NovoLeadDialog({ open, onOpenChange, onCriado }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCriado: (lead: Lead) => void
}) {
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    setErro(null)
    const { data, error } = await (createClient() as any)
      .from('leads')
      .insert({
        nome: form.nome.trim(),
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        empresa: form.empresa.trim() || null,
        origem: form.origem,
        valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
        observacoes: form.observacoes.trim() || null,
      })
      .select(LEAD_SELECT)
      .single()
    setSalvando(false)
    if (error || !data) {
      setErro('Não foi possível salvar. A migration do funil já foi aplicada no Supabase?')
      return
    }
    onCriado(data as Lead)
    setForm(VAZIO)
    onOpenChange(false)
  }

  const set = (campo: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>Contato que chegou por fora do site.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={set('nome')} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={form.telefone} onChange={set('telefone')} placeholder="(16) 91234-5678" />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input value={form.empresa} onChange={set('empresa')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={form.origem} onValueChange={(origem) => setForm((f) => ({ ...f, origem }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {origemOpcoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor estimado (R$)</Label>
              <Input type="number" min="0" step="100" value={form.valor_estimado} onChange={set('valor_estimado')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Anotações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={set('observacoes')} placeholder="O que a pessoa precisa?" />
          </div>
          {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !form.nome.trim()}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

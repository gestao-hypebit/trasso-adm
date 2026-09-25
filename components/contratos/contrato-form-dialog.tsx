'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { proximoNumeroContrato } from '@/lib/contratos/numero'
import { toISODateLocal } from '@/lib/utils'

export type ContratoEditavel = {
  id: string; cliente_id: string | null; titulo: string; tipo: string | null; status: string
  valor_total: number; data_inicio: string | null; data_fim: string | null
  condicoes_pagamento: string | null; clausulas: string | null
}

interface Props {
  contrato?: ContratoEditavel
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (id: string) => void
}

const vazio = (): Omit<ContratoEditavel, 'id'> => ({
  cliente_id: null, titulo: '', tipo: 'pontual', status: 'rascunho', valor_total: 0,
  data_inicio: toISODateLocal(new Date()), data_fim: null, condicoes_pagamento: '', clausulas: '',
})

export function ContratoFormDialog({ contrato, open, onOpenChange, onSaved }: Props) {
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([])
  const [form, setForm] = useState(vazio())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErro(null)
    setForm(contrato ? { ...contrato } : vazio())
    createClient().from('clientes').select('id, nome').order('nome').then(({ data }) => setClientes(data ?? []))
    // Reinicia o formulário só ao abrir; o objeto contrato muda de referência a cada render do pai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSalvar() {
    if (!form.titulo.trim()) { setErro('Informe o título.'); return }
    if (!form.cliente_id) { setErro('Selecione o cliente.'); return }
    setSalvando(true)
    setErro(null)
    const supabase = createClient() as any
    const payload = {
      cliente_id: form.cliente_id,
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      status: form.status,
      valor_total: Number(form.valor_total) || 0,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      condicoes_pagamento: form.condicoes_pagamento || null,
      clausulas: form.clausulas || null,
    }
    const { data, error } = contrato
      ? await supabase.from('contratos').update(payload).eq('id', contrato.id).select('id').single()
      : await supabase.from('contratos').insert({ ...payload, numero: await proximoNumeroContrato(supabase) }).select('id').single()
    setSalvando(false)
    if (error) { setErro(error.message); return }
    onOpenChange(false)
    onSaved(data.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contrato ? 'Editar contrato' : 'Novo contrato'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="col-span-2 space-y-1.5">
            <Label>Cliente *</Label>
            <Select value={form.cliente_id ?? ''} onValueChange={(v) => set('cliente_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex: Desenvolvimento do site institucional" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.tipo ?? 'pontual'} onValueChange={(v) => set('tipo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pontual">Pontual</SelectItem>
                <SelectItem value="servico">Serviço</SelectItem>
                <SelectItem value="retainer">Retainer</SelectItem>
                <SelectItem value="parceria">Parceria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="assinado">Assinado</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor total (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_total} onChange={(e) => set('valor_total', e.target.value as unknown as number)} />
          </div>
          <div className="space-y-1.5">
            <Label>Início</Label>
            <Input type="date" value={form.data_inicio ?? ''} onChange={(e) => set('data_inicio', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Término</Label>
            <Input type="date" value={form.data_fim ?? ''} onChange={(e) => set('data_fim', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Condições de pagamento</Label>
            <Input value={form.condicoes_pagamento ?? ''} onChange={(e) => set('condicoes_pagamento', e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Cláusulas</Label>
            <Textarea rows={8} value={form.clausulas ?? ''} onChange={(e) => set('clausulas', e.target.value)} />
          </div>
          {form.status === 'enviado' && (
            <p className="col-span-2 text-xs text-brand-lavanda/50">Com status &quot;Enviado&quot;, o cliente pode assinar o contrato pelo portal.</p>
          )}
          {erro && <p className="col-span-2 text-xs text-brand-rosa">{erro}</p>}
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : contrato ? 'Salvar' : 'Criar contrato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

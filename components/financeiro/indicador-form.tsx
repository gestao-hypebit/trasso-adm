'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { indicadorSchema, type IndicadorFormData } from '@/lib/validations/indicador'
import { criarIndicadorAction, atualizarIndicadorAction } from '@/app/(dashboard)/financeiro/comissoes/actions'

type ClienteOption = { id: string; nome: string }

export type IndicadorExistente = {
  id: string
  tipo: string
  cliente_id: string | null
  nome: string
  email: string | null
  telefone: string | null
  whatsapp: string | null
  chave_pix: string | null
  observacoes: string | null
  ativo: boolean
}

interface IndicadorFormProps {
  indicador?: IndicadorExistente
  onSuccess?: () => void
}

export function IndicadorForm({ indicador, onSuccess }: IndicadorFormProps) {
  const isEdit = !!indicador
  const [open, setOpen] = useState(false)
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [erro, setErro] = useState<string | null>(null)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<IndicadorFormData>({
    resolver: zodResolver(indicadorSchema),
    defaultValues: indicador
      ? {
          tipo: indicador.tipo as 'cliente' | 'externo',
          cliente_id: indicador.cliente_id ?? undefined,
          nome: indicador.nome,
          email: indicador.email ?? '',
          telefone: indicador.telefone ?? '',
          whatsapp: indicador.whatsapp ?? '',
          chave_pix: indicador.chave_pix ?? '',
          observacoes: indicador.observacoes ?? '',
          ativo: indicador.ativo,
        }
      : { tipo: 'externo', ativo: true },
  })

  const tipo = watch('tipo')

  useEffect(() => {
    if (!open || tipo !== 'cliente') return
    createClient().from('clientes').select('id, nome').order('nome').then(({ data }) => setClientes(data ?? []))
  }, [open, tipo])

  function handleClose() {
    reset()
    setErro(null)
    setOpen(false)
  }

  async function onSubmit(data: IndicadorFormData) {
    setErro(null)
    const result = isEdit
      ? await atualizarIndicadorAction(indicador!.id, data)
      : await criarIndicadorAction(data)

    if (!result.success) {
      setErro(result.error)
      return
    }
    onSuccess?.()
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        {isEdit ? (
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-brand-lavanda/40 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" />
            Novo Indicador
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Indicador' : 'Novo Indicador'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="flex rounded-xl border border-white/[0.1] overflow-hidden">
            {(['externo', 'cliente'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setValue('tipo', t); setValue('cliente_id', undefined) }}
                className={cn(
                  'flex-1 py-2.5 text-sm font-semibold transition-all',
                  tipo === t ? 'bg-brand-violeta text-brand-lavanda' : 'text-brand-lavanda/60 hover:text-brand-lavanda hover:bg-brand-violeta/10'
                )}
              >
                {t === 'externo' ? 'Parceiro Externo' : 'Cliente Existente'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {tipo === 'cliente' && (
              <div className="col-span-2">
                <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Cliente *</Label>
                <Select value={watch('cliente_id')} onValueChange={(v) => setValue('cliente_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.cliente_id && <p className="text-brand-rosa text-xs mt-1">{errors.cliente_id.message}</p>}
              </div>
            )}

            <div className="col-span-2">
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Nome *</Label>
              <Input {...register('nome')} placeholder="Nome do indicador" />
              {errors.nome && <p className="text-brand-rosa text-xs mt-1">{errors.nome.message}</p>}
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Email</Label>
              <Input {...register('email')} type="email" placeholder="email@exemplo.com" />
              {errors.email && <p className="text-brand-rosa text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Telefone</Label>
              <Input {...register('telefone')} placeholder="(00) 00000-0000" />
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">WhatsApp</Label>
              <Input {...register('whatsapp')} placeholder="(00) 00000-0000" />
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Chave PIX</Label>
              <Input {...register('chave_pix')} placeholder="CPF, email, telefone..." />
            </div>

            <div className="col-span-2">
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Observações</Label>
              <Textarea {...register('observacoes')} placeholder="Notas adicionais..." rows={2} />
            </div>
          </div>

          {erro && <p className="text-brand-rosa text-xs">{erro}</p>}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar Indicador'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

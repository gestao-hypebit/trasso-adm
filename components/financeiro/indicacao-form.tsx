'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { indicacaoSchema, type IndicacaoFormData } from '@/lib/validations/indicacao'
import { criarIndicacaoAction } from '@/app/(dashboard)/financeiro/comissoes/actions'

type IndicadorOption = { id: string; nome: string }
type ClienteOption = { id: string; nome: string }

interface IndicacaoFormProps {
  onSuccess?: () => void
}

export function IndicacaoForm({ onSuccess }: IndicacaoFormProps) {
  const [open, setOpen] = useState(false)
  const [indicadores, setIndicadores] = useState<IndicadorOption[]>([])
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [erro, setErro] = useState<string | null>(null)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<IndicacaoFormData>({
    resolver: zodResolver(indicacaoSchema),
    defaultValues: {
      tipo_comissao: 'fixo',
      status: 'ativa',
      data_inicio: new Date().toISOString().slice(0, 10),
    },
  })

  const tipoComissao = watch('tipo_comissao')

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    Promise.all([
      supabase.from('indicadores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('clientes').select('id, nome').eq('status', 'ativo').order('nome'),
    ]).then(([i, c]) => {
      setIndicadores(i.data ?? [])
      setClientes(c.data ?? [])
    })
  }, [open])

  function handleClose() {
    reset()
    setErro(null)
    setOpen(false)
  }

  async function onSubmit(data: IndicacaoFormData) {
    setErro(null)
    const result = await criarIndicacaoAction(data)
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
        <Button>
          <Plus className="h-4 w-4" />
          Nova Indicação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Indicação</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Indicador *</Label>
              <Select value={watch('indicador_id')} onValueChange={(v) => setValue('indicador_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {indicadores.map((i) => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.indicador_id && <p className="text-brand-rosa text-xs mt-1">{errors.indicador_id.message}</p>}
            </div>

            <div className="col-span-2">
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Cliente indicado *</Label>
              <Select value={watch('cliente_indicado_id')} onValueChange={(v) => setValue('cliente_indicado_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.cliente_indicado_id && <p className="text-brand-rosa text-xs mt-1">{errors.cliente_indicado_id.message}</p>}
            </div>

            <div className="col-span-2 flex rounded-xl border border-white/[0.1] overflow-hidden">
              {(['fixo', 'percentual'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue('tipo_comissao', t)}
                  className={cn(
                    'flex-1 py-2.5 text-sm font-semibold transition-all',
                    tipoComissao === t ? 'bg-brand-lima text-brand-noite' : 'text-brand-lavanda/60 hover:text-brand-lavanda hover:bg-brand-violeta/10'
                  )}
                >
                  {t === 'fixo' ? 'Valor Fixo (R$)' : 'Percentual (%)'}
                </button>
              ))}
            </div>

            {tipoComissao === 'fixo' ? (
              <div className="col-span-2">
                <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Valor mensal (R$) *</Label>
                <Input type="number" step="0.01" placeholder="15,00" {...register('valor_fixo', { valueAsNumber: true })} />
                {errors.valor_fixo && <p className="text-brand-rosa text-xs mt-1">{errors.valor_fixo.message}</p>}
              </div>
            ) : (
              <div className="col-span-2">
                <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Percentual sobre a receita mensal (%) *</Label>
                <Input type="number" step="0.01" placeholder="30" {...register('percentual', { valueAsNumber: true })} />
                {errors.percentual && <p className="text-brand-rosa text-xs mt-1">{errors.percentual.message}</p>}
              </div>
            )}

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Data de início *</Label>
              <Input {...register('data_inicio')} type="date" />
              {errors.data_inicio && <p className="text-brand-rosa text-xs mt-1">{errors.data_inicio.message}</p>}
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Status</Label>
              <Select defaultValue="ativa" onValueChange={(v) => setValue('status', v as IndicacaoFormData['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                  <SelectItem value="encerrada">Encerrada</SelectItem>
                </SelectContent>
              </Select>
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
              {isSubmitting ? 'Salvando...' : 'Salvar Indicação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

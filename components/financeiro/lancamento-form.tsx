'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  descricao: z.string().min(1, 'Descrição obrigatória'),
  valor: z.string().min(1, 'Valor obrigatório'),
  data: z.string().min(1, 'Data obrigatória'),
  categoria: z.string().min(1, 'Categoria obrigatória'),
  cliente: z.string().optional(),
  forma_pagamento: z.string().optional(),
  status: z.string(),
  observacoes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const formasPagamento = [
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'dinheiro', label: 'Dinheiro' },
]

type Frequencia = 'mensal' | 'quinzenal' | 'semanal' | 'anual'

const frequenciaLabel: Record<Frequencia, string> = {
  mensal: 'Mensal',
  quinzenal: 'Quinzenal',
  semanal: 'Semanal',
  anual: 'Anual',
}

function generateDates(startDate: string, frequencia: Frequencia, count: number): string[] {
  const dates: string[] = []
  // Parse as local date to avoid timezone shifts
  const [year, month, day] = startDate.split('-').map(Number)
  let cur = new Date(year, month - 1, day)
  for (let i = 0; i < count; i++) {
    dates.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    )
    if (frequencia === 'mensal') {
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate())
    } else if (frequencia === 'quinzenal') {
      cur = new Date(cur.getTime() + 14 * 86400000)
    } else if (frequencia === 'semanal') {
      cur = new Date(cur.getTime() + 7 * 86400000)
    } else if (frequencia === 'anual') {
      cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate())
    }
  }
  return dates
}

interface LancamentoFormProps {
  defaultTipo?: 'receita' | 'despesa'
  onSuccess?: () => void
}

type ClienteOption = { id: string; nome: string }
type CategoriaOption = { id: string; nome: string }

export function LancamentoForm({ defaultTipo = 'receita', onSuccess }: LancamentoFormProps) {
  const [open, setOpen] = useState(false)
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [categorias, setCategorias] = useState<CategoriaOption[]>([])
  const [isRecorrente, setIsRecorrente] = useState(false)
  const [frequencia, setFrequencia] = useState<Frequencia>('mensal')
  const [meses, setMeses] = useState(12)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: defaultTipo, status: 'pendente' },
  })

  const tipo = watch('tipo')

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    Promise.all([
      supabase.from('clientes').select('id, nome').order('nome'),
      supabase.from('categorias_financeiras').select('id, nome').eq('tipo', tipo).order('nome'),
    ]).then(([c, cat]) => {
      setClientes(c.data ?? [])
      setCategorias(cat.data ?? [])
    })
  }, [open, tipo])

  function handleClose() {
    reset()
    setIsRecorrente(false)
    setFrequencia('mensal')
    setMeses(12)
    setOpen(false)
  }

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const db = supabase as any

    // Resolve categoria_id
    let categoriaId: string | null = null
    const { data: catExistente } = await db
      .from('categorias_financeiras')
      .select('id')
      .eq('nome', data.categoria)
      .eq('tipo', data.tipo)
      .maybeSingle() as { data: { id: string } | null }

    if (catExistente) {
      categoriaId = catExistente.id
    } else {
      const { data: novaCat } = await db
        .from('categorias_financeiras')
        .insert({ nome: data.categoria, tipo: data.tipo })
        .select('id')
        .single() as { data: { id: string } | null }
      categoriaId = novaCat?.id ?? null
    }

    const base = {
      tipo: data.tipo,
      descricao: data.descricao,
      valor: parseFloat(data.valor),
      categoria_id: categoriaId,
      cliente_id: data.cliente || null,
      forma_pagamento: data.forma_pagamento || null,
      observacoes: data.observacoes || null,
    }

    if (isRecorrente) {
      const dates = generateDates(data.data, frequencia, meses)
      const entries = dates.map((date, i) => ({
        ...base,
        data: date,
        status: i === 0 ? data.status : 'pendente',
        recorrente: true,
        frequencia,
      }))
      await db.from('lancamentos').insert(entries)
    } else {
      await db.from('lancamentos').insert({
        ...base,
        data: data.data,
        status: data.status,
        recorrente: false,
        frequencia: null,
      })
    }

    onSuccess?.()
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Tipo */}
          <div className="flex rounded-xl border border-white/[0.1] overflow-hidden">
            {(['receita', 'despesa'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setValue('tipo', t); setValue('categoria', '') }}
                className={cn(
                  'flex-1 py-2.5 text-sm font-semibold transition-all',
                  tipo === t
                    ? t === 'receita' ? 'bg-brand-lima text-brand-noite' : 'bg-brand-rosa text-white'
                    : 'text-brand-lavanda/60 hover:text-brand-lavanda hover:bg-brand-violeta/10'
                )}
              >
                {t === 'receita' ? 'Receita' : 'Despesa'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Descrição *</Label>
              <Input {...register('descricao')} placeholder="Ex: Mensalidade retainer — Studio Forma" />
              {errors.descricao && <p className="text-brand-rosa text-xs mt-1">{errors.descricao.message}</p>}
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Valor (R$) *</Label>
              <Input {...register('valor')} type="number" step="0.01" placeholder="0,00" />
              {errors.valor && <p className="text-brand-rosa text-xs mt-1">{errors.valor.message}</p>}
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">{isRecorrente ? 'Data de início *' : 'Data *'}</Label>
              <Input {...register('data')} type="date" />
              {errors.data && <p className="text-brand-rosa text-xs mt-1">{errors.data.message}</p>}
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Categoria *</Label>
              <Select onValueChange={(v) => setValue('categoria', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.categoria && <p className="text-brand-rosa text-xs mt-1">{errors.categoria.message}</p>}
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Status {isRecorrente ? '(1ª entrada)' : ''}</Label>
              <Select defaultValue="pendente" onValueChange={(v) => setValue('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  {tipo === 'receita'
                    ? <SelectItem value="recebido">Recebido</SelectItem>
                    : <SelectItem value="pago">Pago</SelectItem>
                  }
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Cliente</Label>
              <Select onValueChange={(v) => setValue('cliente', v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Forma de Pagamento</Label>
              <Select onValueChange={(v) => setValue('forma_pagamento', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Observações</Label>
              <Textarea {...register('observacoes')} placeholder="Notas adicionais..." rows={2} />
            </div>

            {/* Toggle recorrente */}
            <div className="col-span-2">
              <button
                type="button"
                onClick={() => setIsRecorrente(v => !v)}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all text-left',
                  isRecorrente
                    ? 'border-brand-lima/30 bg-brand-lima/[0.05]'
                    : 'border-white/[0.1] bg-white/[0.02] hover:border-white/[0.15]'
                )}
              >
                <div className="flex items-center gap-3">
                  <RefreshCw className={cn('h-4 w-4 shrink-0', isRecorrente ? 'text-brand-lima' : 'text-brand-lavanda/40')} />
                  <div>
                    <p className={cn('text-sm font-medium', isRecorrente ? 'text-brand-lima' : 'text-brand-lavanda/70')}>
                      Lançamento recorrente
                    </p>
                    <p className="text-xs text-brand-lavanda/40 mt-0.5">
                      {isRecorrente ? `Gerará ${meses} entradas ${frequenciaLabel[frequencia].toLowerCase()}s` : 'Gera entradas futuras automaticamente'}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
                  isRecorrente ? 'bg-brand-lima' : 'bg-white/[0.15]'
                )}>
                  <span className={cn(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                    isRecorrente ? 'translate-x-4' : 'translate-x-0'
                  )} />
                </div>
              </button>
            </div>

            {/* Opções recorrente */}
            {isRecorrente && (
              <div className="col-span-2 grid grid-cols-2 gap-3 pl-1">
                <div>
                  <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Frequência</Label>
                  <Select value={frequencia} onValueChange={(v) => setFrequencia(v as Frequencia)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">
                    {frequencia === 'semanal' ? 'Semanas' : frequencia === 'quinzenal' ? 'Quinzenas' : frequencia === 'anual' ? 'Anos' : 'Meses'} a gerar
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={meses}
                    onChange={e => setMeses(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Salvando...'
                : isRecorrente
                  ? `Criar ${meses} lançamentos`
                  : 'Salvar Lançamento'
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

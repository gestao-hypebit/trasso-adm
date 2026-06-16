'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Plus, Trash2, Loader2, RefreshCw } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type ClienteOption = { id: string; nome: string }

const RECORRENCIA_LABELS: Record<string, string> = {
  avulso: 'Avulso', mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual',
}

const itemSchema = z.object({
  descricao: z.string().min(1),
  quantidade: z.coerce.number().min(0.01),
  valor_unitario: z.coerce.number().min(0),
  recorrencia: z.enum(['avulso', 'mensal', 'trimestral', 'anual']).default('avulso'),
})

const schema = z.object({
  cliente_id: z.string().min(1, 'Selecione um cliente'),
  titulo: z.string().min(1, 'Título obrigatório'),
  descricao: z.string().optional(),
  validade: z.string().min(1, 'Data de validade obrigatória'),
  condicoes_pagamento: z.string().optional(),
  desconto_percentual: z.coerce.number().min(0).max(100),
  observacoes: z.string().optional(),
  itens: z.array(itemSchema).min(1, 'Adicione pelo menos um item'),
})

type FormData = z.infer<typeof schema>

export default function EditarPropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [numero, setNumero] = useState('')

  const { register, handleSubmit, watch, setValue, control, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      desconto_percentual: 0,
      itens: [{ descricao: '', quantidade: 1, valor_unitario: 0, recorrencia: 'avulso' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })
  const itens = watch('itens')
  const desconto = watch('desconto_percentual') || 0
  const clienteIdAtual = watch('cliente_id')

  const avulsos = itens.filter(i => i.recorrencia === 'avulso')
  const recorrentes = itens.filter(i => i.recorrencia !== 'avulso')
  const subtotalAvulso = avulsos.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0)
  const subtotalRecorrente = recorrentes.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0)
  const subtotal = subtotalAvulso + subtotalRecorrente
  const descontoValor = subtotal * (desconto / 100)
  const total = subtotal - descontoValor

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: clientesData }, { data: proposta }] = await Promise.all([
        supabase.from('clientes').select('id, nome').order('nome'),
        (supabase as any).from('propostas')
          .select('*, proposta_itens(*)')
          .eq('id', id)
          .single(),
      ])
      setClientes(clientesData ?? [])
      if (proposta) {
        setNumero(proposta.numero)
        const itensOrdenados = [...(proposta.proposta_itens ?? [])].sort((a: any, b: any) => a.ordem - b.ordem)
        reset({
          cliente_id: proposta.cliente_id,
          titulo: proposta.titulo,
          descricao: proposta.descricao ?? '',
          validade: proposta.validade ?? '',
          condicoes_pagamento: proposta.condicoes_pagamento ?? '',
          desconto_percentual: proposta.desconto_percentual ?? 0,
          observacoes: proposta.observacoes ?? '',
          itens: itensOrdenados.map((item: any) => ({
            descricao: item.descricao,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            recorrencia: item.recorrencia ?? 'avulso',
          })),
        })
      }
      setLoading(false)
    }
    load()
  }, [id, reset])

  async function onSubmit(data: FormData) {
    setSubmitError(null)
    const supabase = createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('propostas')
      .update({
        cliente_id: data.cliente_id,
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        validade: data.validade,
        condicoes_pagamento: data.condicoes_pagamento ?? null,
        desconto_percentual: data.desconto_percentual,
        observacoes: data.observacoes ?? null,
        valor_total: subtotal,
      })
      .eq('id', id)

    if (error) {
      setSubmitError(`Erro ao atualizar proposta: ${error.message}`)
      return
    }

    await supabase.from('proposta_itens').delete().eq('proposta_id', id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: itemsError } = await supabase.from('proposta_itens').insert(
      data.itens.map((item, idx) => ({
        proposta_id: id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        recorrencia: item.recorrencia,
        ordem: idx + 1,
      })) as any
    )

    if (itemsError) {
      setSubmitError(`Proposta atualizada mas erro ao salvar itens: ${itemsError.message}`)
      return
    }

    router.push(`/propostas/${id}`)
  }

  if (loading) return <div className="p-6 text-brand-lavanda/40 text-sm">Carregando...</div>

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Editar Proposta" description={numero} />

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/propostas/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Editar Proposta <span className="text-brand-lavanda/40 font-mono text-base">{numero}</span>
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Informações Gerais</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Cliente *</Label>
                      <Select
                        key={clienteIdAtual}
                        defaultValue={clienteIdAtual}
                        onValueChange={(v) => setValue('cliente_id', v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                        <SelectContent>
                          {clientes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.cliente_id && <p className="text-brand-rosa text-xs mt-1">{errors.cliente_id.message}</p>}
                    </div>
                    <div>
                      <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Válida até *</Label>
                      <Input {...register('validade')} type="date" />
                      {errors.validade && <p className="text-brand-rosa text-xs mt-1">{errors.validade.message}</p>}
                    </div>
                  </div>

                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Título da Proposta *</Label>
                    <Input {...register('titulo')} placeholder="Ex: Identidade Visual + Site Institucional" />
                    {errors.titulo && <p className="text-brand-rosa text-xs mt-1">{errors.titulo.message}</p>}
                  </div>

                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Descrição / Escopo</Label>
                    <Textarea {...register('descricao')} placeholder="Descreva o escopo do projeto..." rows={3} />
                  </div>

                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Condições de Pagamento</Label>
                    <Input {...register('condicoes_pagamento')} placeholder="Ex: 50% na aprovação, 50% na entrega" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Itens da Proposta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-2 text-xs text-brand-lavanda/40 px-1">
                      <span className="col-span-4">Descrição</span>
                      <span className="col-span-2">Recorrência</span>
                      <span className="col-span-2 text-center">Qtd</span>
                      <span className="col-span-2 text-right">Valor Unit.</span>
                      <span className="col-span-2 text-right">Total</span>
                    </div>

                    {fields.map((field, idx) => {
                      const qtd = Number(watch(`itens.${idx}.quantidade`)) || 0
                      const vu = Number(watch(`itens.${idx}.valor_unitario`)) || 0
                      const rec = watch(`itens.${idx}.recorrencia`) ?? 'avulso'
                      const isRec = rec !== 'avulso'
                      return (
                        <div key={field.id} className={`grid grid-cols-12 gap-2 items-center rounded-lg px-1 py-0.5 ${isRec ? 'bg-brand-violeta/5 border border-brand-violeta/20' : ''}`}>
                          <div className="col-span-4">
                            <Input {...register(`itens.${idx}.descricao`)} placeholder="Descrição do serviço..." className="h-9 text-sm" />
                          </div>
                          <div className="col-span-2">
                            <Select
                              key={`${field.id}-rec`}
                              defaultValue={rec}
                              onValueChange={(v) => setValue(`itens.${idx}.recorrencia`, v as 'avulso' | 'mensal' | 'trimestral' | 'anual')}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(RECORRENCIA_LABELS).map(([k, l]) => (
                                  <SelectItem key={k} value={k}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Input {...register(`itens.${idx}.quantidade`)} type="number" min="0.01" step="0.5" className="h-9 text-sm text-center" />
                          </div>
                          <div className="col-span-2">
                            <Input {...register(`itens.${idx}.valor_unitario`)} type="number" min="0" step="50" className="h-9 text-sm text-right" />
                          </div>
                          <div className="col-span-1 text-right text-xs font-medium text-brand-lavanda">
                            {formatCurrency(qtd * vu)}
                            {isRec && <span className="block text-brand-violeta/60" style={{ fontSize: 9 }}>/{rec}</span>}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-brand-rosa/50 hover:text-brand-rosa"
                              onClick={() => remove(idx)} disabled={fields.length === 1}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}

                    <Button type="button" variant="outline" size="sm" className="w-full mt-2"
                      onClick={() => append({ descricao: '', quantidade: 1, valor_unitario: 0, recorrencia: 'avulso' })}>
                      <Plus className="h-4 w-4" /> Adicionar Item
                    </Button>
                  </div>

                  <Separator className="my-4 bg-brand-violeta/20" />

                  <div className="flex justify-end">
                    <div className="w-72 space-y-2">
                      {subtotalAvulso > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-brand-lavanda/60">Serviços avulsos</span>
                          <span className="text-brand-lavanda">{formatCurrency(subtotalAvulso)}</span>
                        </div>
                      )}
                      {subtotalRecorrente > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-brand-lavanda/60 flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Recorrentes/mês</span>
                          <span className="text-brand-violeta">{formatCurrency(subtotalRecorrente)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-brand-lavanda/60">Desconto (%)</span>
                        <Input {...register('desconto_percentual')} type="number" min="0" max="100" step="1" className="h-8 w-24 text-sm text-right" />
                      </div>
                      {desconto > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-brand-lavanda/60">Desconto</span>
                          <span className="text-brand-rosa">−{formatCurrency(descontoValor)}</span>
                        </div>
                      )}
                      <Separator className="bg-brand-violeta/20" />
                      <div className="flex justify-between">
                        <span className="font-bold text-brand-lavanda">Total</span>
                        <span className="font-bold text-brand-lima text-xl">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Termos e Observações</CardTitle></CardHeader>
                <CardContent>
                  <Textarea {...register('observacoes')} placeholder="Condições gerais, prazo de entrega, rodadas de revisão..." rows={4} />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="sticky top-20">
                <CardHeader><CardTitle className="text-sm">Resumo</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-brand-lavanda/40">Valor Total</p>
                    <p className="text-3xl font-bold text-brand-lima" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                      {formatCurrency(total)}
                    </p>
                    {subtotalRecorrente > 0 && (
                      <p className="text-xs text-brand-violeta mt-1 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" /> + {formatCurrency(subtotalRecorrente)}/mês recorrente
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-brand-lavanda/50 space-y-1">
                    <div className="flex justify-between">
                      <span>Itens</span><span>{fields.length}</span>
                    </div>
                    {desconto > 0 && (
                      <div className="flex justify-between">
                        <span>Desconto</span><span className="text-brand-rosa">−{desconto}%</span>
                      </div>
                    )}
                  </div>
                  <Separator className="bg-brand-violeta/20" />
                  <div className="space-y-2">
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
                    </Button>
                    <Button type="button" variant="outline" className="w-full" asChild>
                      <Link href={`/propostas/${id}`}>Cancelar</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          {submitError && (
            <div className="mt-4 p-3 rounded-lg bg-brand-rosa/10 border border-brand-rosa/30 text-brand-rosa text-sm">
              {submitError}
            </div>
          )}
        </form>
      </main>
    </div>
  )
}

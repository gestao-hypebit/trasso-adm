'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
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

const itemSchema = z.object({
  descricao: z.string().min(1),
  quantidade: z.coerce.number().min(0.01),
  valor_unitario: z.coerce.number().min(0),
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

const servicosBase = [
  { nome: 'Pesquisa de marca e briefing', preco: 1500 },
  { nome: 'Desenvolvimento de logotipo', preco: 3500 },
  { nome: 'Manual de identidade visual', preco: 2500 },
  { nome: 'Design UI/UX de site', preco: 4500 },
  { nome: 'Desenvolvimento front-end', preco: 5500 },
  { nome: 'Social media — pacote mensal', preco: 2800 },
  { nome: 'Campanha Google Ads', preco: 1200 },
  { nome: 'Fotografia editorial', preco: 2000 },
]

export default function NovaPropostaPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<ClienteOption[]>([])

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      desconto_percentual: 0,
      itens: [{ descricao: '', quantidade: 1, valor_unitario: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })
  const itens = watch('itens')
  const desconto = watch('desconto_percentual') || 0

  const subtotal = itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0)
  const descontoValor = subtotal * (desconto / 100)
  const total = subtotal - descontoValor

  useEffect(() => {
    const supabase = createClient()
    supabase.from('clientes').select('id, nome').order('nome').then(({ data }) => {
      setClientes(data ?? [])
    })
  }, [])

  async function onSubmit(data: FormData) {
    const supabase = createClient()

    const { data: contagem } = await supabase
      .from('propostas')
      .select('id', { count: 'exact', head: true })
    const numero = `TRS-${new Date().getFullYear()}-${String((contagem as any)?.length ?? 0 + 1).padStart(3, '0')}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: propostaRaw, error } = await (supabase as any)
      .from('propostas')
      .insert({
        cliente_id: data.cliente_id,
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        validade: data.validade,
        condicoes_pagamento: data.condicoes_pagamento ?? null,
        desconto_percentual: data.desconto_percentual,
        observacoes: data.observacoes ?? null,
        status: 'rascunho',
        numero,
        valor_total: subtotal,
        valor_final: total,
      })
      .select('id')
      .single()
    const proposta = propostaRaw as { id: string } | null

    if (error || !proposta) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('proposta_itens').insert(
      data.itens.map((item, idx) => ({
        proposta_id: proposta.id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.quantidade * item.valor_unitario,
        ordem: idx + 1,
      })) as any
    )

    router.push('/propostas')
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Nova Proposta" description="Crie uma nova proposta comercial" />

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/propostas">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Nova Proposta
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
                      <Select onValueChange={(v) => setValue('cliente_id', v)}>
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Itens da Proposta</CardTitle>
                    <Select onValueChange={(v) => {
                      const s = servicosBase.find(s => s.nome === v)
                      if (s) append({ descricao: s.nome, quantidade: 1, valor_unitario: s.preco })
                    }}>
                      <SelectTrigger className="w-48 h-8 text-xs">
                        <SelectValue placeholder="Adicionar do catálogo" />
                      </SelectTrigger>
                      <SelectContent>
                        {servicosBase.map((s) => (
                          <SelectItem key={s.nome} value={s.nome}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-2 text-xs text-brand-lavanda/40 px-1">
                      <span className="col-span-6">Descrição</span>
                      <span className="col-span-2 text-center">Qtd</span>
                      <span className="col-span-2 text-right">Valor Unit.</span>
                      <span className="col-span-2 text-right">Total</span>
                    </div>

                    {fields.map((field, idx) => {
                      const qtd = Number(watch(`itens.${idx}.quantidade`)) || 0
                      const vu = Number(watch(`itens.${idx}.valor_unitario`)) || 0
                      return (
                        <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6">
                            <Input {...register(`itens.${idx}.descricao`)} placeholder="Descrição do serviço..." className="h-9 text-sm" />
                          </div>
                          <div className="col-span-2">
                            <Input {...register(`itens.${idx}.quantidade`)} type="number" min="0.01" step="0.5" className="h-9 text-sm text-center" />
                          </div>
                          <div className="col-span-2">
                            <Input {...register(`itens.${idx}.valor_unitario`)} type="number" min="0" step="50" className="h-9 text-sm text-right" />
                          </div>
                          <div className="col-span-1 text-right text-sm font-medium text-brand-lavanda">
                            {formatCurrency(qtd * vu)}
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
                      onClick={() => append({ descricao: '', quantidade: 1, valor_unitario: 0 })}>
                      <Plus className="h-4 w-4" /> Adicionar Item
                    </Button>
                  </div>

                  <Separator className="my-4 bg-brand-violeta/20" />

                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-lavanda/60">Subtotal</span>
                        <span className="text-brand-lavanda">{formatCurrency(subtotal)}</span>
                      </div>
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
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Proposta'}
                    </Button>
                    <Button type="button" variant="outline" className="w-full" asChild>
                      <Link href="/propostas">Cancelar</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}

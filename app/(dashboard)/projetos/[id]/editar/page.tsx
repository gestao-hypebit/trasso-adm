'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { projetoSchema, type ProjetoFormData } from '@/lib/validations/projeto'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

type ClienteOption = { id: string; nome: string }

export default function EditarProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<ProjetoFormData>({
    resolver: zodResolver(projetoSchema) as Resolver<ProjetoFormData>,
    defaultValues: { status: 'backlog', prioridade: 'media', progresso: 0 },
  })

  const clienteIdAtual = watch('cliente_id')
  const tipoAtual = watch('tipo')
  const statusAtual = watch('status')
  const prioridadeAtual = watch('prioridade')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: clientesData }, { data: projeto }] = await Promise.all([
        supabase.from('clientes').select('id, nome').order('nome'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('projetos').select('*').eq('id', id).single(),
      ])
      setClientes(clientesData ?? [])
      if (projeto) {
        reset({
          nome: projeto.nome,
          descricao: projeto.descricao ?? undefined,
          cliente_id: projeto.cliente_id ?? undefined,
          tipo: projeto.tipo ?? undefined,
          status: projeto.status,
          prioridade: projeto.prioridade,
          valor: projeto.valor ?? undefined,
          data_inicio: projeto.data_inicio ?? undefined,
          data_entrega: projeto.data_entrega ?? undefined,
          progresso: projeto.progresso,
        })
      }
      setLoading(false)
    }
    load()
  }, [id, reset])

  async function onSubmit(data: ProjetoFormData) {
    setSubmitError(null)
    const supabase = createClient()
    const { error } = await supabase.from('projetos').update({
      nome: data.nome,
      descricao: data.descricao ?? null,
      cliente_id: data.cliente_id ?? null,
      tipo: data.tipo ?? null,
      status: data.status,
      prioridade: data.prioridade,
      valor: data.valor ?? null,
      data_inicio: data.data_inicio ?? null,
      data_entrega: data.data_entrega ?? null,
      progresso: data.progresso,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).eq('id', id)
    if (!error) {
      router.push(`/projetos/${id}`)
    } else {
      console.error('Erro ao atualizar projeto:', error)
      setSubmitError(`${error.code ?? ''} ${error.message}`.trim())
    }
  }

  if (loading) return <div className="p-6 text-brand-lavanda/40 text-sm">Carregando...</div>

  return (
    <div>
      <Header title="Editar Projeto" />
      <div className="p-6">
        <PageHeader title="Editar Projeto" description="Atualize as informações do projeto">
          <Link href={`/projetos/${id}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </Link>
        </PageHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Informações do Projeto</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome do Projeto *</Label>
                    <Input id="nome" placeholder="Ex: Site Institucional 2025" {...register('nome')} />
                    {errors.nome && <p className="text-xs text-brand-rosa">{errors.nome.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select key={`cliente-${clienteIdAtual}`} defaultValue={clienteIdAtual} onValueChange={(v) => setValue('cliente_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea id="descricao" placeholder="Descreva o escopo do projeto..." rows={3} {...register('descricao')} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="data_inicio">Data de Início</Label>
                      <Input id="data_inicio" type="date" {...register('data_inicio')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_entrega">Data de Entrega</Label>
                      <Input id="data_entrega" type="date" {...register('data_entrega')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$)</Label>
                    <Input id="valor" type="number" step="0.01" placeholder="0,00" {...register('valor', { valueAsNumber: true })} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Configurações</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select key={`tipo-${tipoAtual}`} defaultValue={tipoAtual} onValueChange={(v) => setValue('tipo', v as any)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="identidade_visual">Identidade Visual</SelectItem>
                        <SelectItem value="site">Site</SelectItem>
                        <SelectItem value="software">Software</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="social_media">Social Media</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select key={`status-${statusAtual}`} defaultValue={statusAtual} onValueChange={(v) => setValue('status', v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">Backlog</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="aguardando_cliente">Aguardando Cliente</SelectItem>
                        <SelectItem value="em_revisao">Em Revisão</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select key={`prioridade-${prioridadeAtual}`} defaultValue={prioridadeAtual} onValueChange={(v) => setValue('prioridade', v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
              {submitError && (
                <p className="text-xs text-brand-rosa break-words">{submitError}</p>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

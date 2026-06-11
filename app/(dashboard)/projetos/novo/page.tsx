'use client'

import { useEffect, useState } from 'react'
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

export default function NovoProjetoPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<ProjetoFormData>({
    resolver: zodResolver(projetoSchema) as Resolver<ProjetoFormData>,
    defaultValues: { status: 'backlog', prioridade: 'media', progresso: 0 },
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.from('clientes').select('id, nome').order('nome').then(({ data }) => {
      setClientes(data ?? [])
    })
  }, [])

  async function onSubmit(data: ProjetoFormData) {
    const supabase = createClient()
    const { error } = await supabase.from('projetos').insert({
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
    } as any)
    if (!error) router.push('/projetos')
  }

  return (
    <div>
      <Header title="Novo Projeto" />
      <div className="p-6">
        <PageHeader title="Novo Projeto" description="Crie um novo projeto">
          <Link href="/projetos">
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
                    <Select onValueChange={(v) => setValue('cliente_id', v)}>
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
                    <Select onValueChange={(v) => setValue('tipo', v as any)}>
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
                    <Select onValueChange={(v) => setValue('status', v as any)} defaultValue="backlog">
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
                    <Select onValueChange={(v) => setValue('prioridade', v as any)} defaultValue="media">
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
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Projeto'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

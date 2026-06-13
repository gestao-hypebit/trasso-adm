'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { clienteSchema, type ClienteFormData } from '@/lib/validations/cliente'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Cliente = Database['public']['Tables']['clientes']['Row']
type Produto = { id: string; nome: string; cor: string }

export default function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema) as Resolver<ClienteFormData>,
  })

  const tipoValue = watch('tipo')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const [{ data: c }, { data: p }] = await Promise.all([
        sb.from('clientes').select('*').eq('id', id).single() as Promise<{ data: Cliente | null }>,
        sb.from('produtos').select('id, nome, cor').eq('tipo', 'saas').eq('ativo', true) as Promise<{ data: Produto[] | null }>,
      ])
      if (c) {
        setCliente(c)
        reset({
          nome: c.nome,
          empresa: c.empresa ?? '',
          email: c.email ?? '',
          telefone: c.telefone ?? '',
          whatsapp: c.whatsapp ?? '',
          cpf_cnpj: c.cpf_cnpj ?? '',
          endereco: c.endereco ?? '',
          cidade: c.cidade ?? '',
          estado: c.estado ?? '',
          cep: c.cep ?? '',
          segmento: c.segmento ?? '',
          origem: c.origem ?? '',
          status: (c.status as ClienteFormData['status']) ?? 'ativo',
          tipo: (c.tipo as ClienteFormData['tipo']) ?? 'agencia',
          produto_id: c.produto_id ?? undefined,
          observacoes: c.observacoes ?? '',
        })
      }
      setProdutos(p ?? [])
      setLoading(false)
    }
    load()
  }, [id, reset])

  async function onSubmit(data: ClienteFormData) {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('clientes').update({
      nome: data.nome,
      empresa: data.empresa || null,
      email: data.email || null,
      telefone: data.telefone || null,
      whatsapp: data.whatsapp || null,
      cpf_cnpj: data.cpf_cnpj || null,
      endereco: data.endereco || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      cep: data.cep || null,
      segmento: data.segmento || null,
      origem: data.origem || null,
      status: data.status,
      tipo: data.tipo ?? 'agencia',
      produto_id: data.produto_id || null,
      observacoes: data.observacoes || null,
    }).eq('id', id)
    if (!error) router.push(`/clientes/${id}`)
  }

  if (loading) return <div className="p-6 text-brand-lavanda/40 text-sm">Carregando...</div>
  if (!cliente) return (
    <div className="p-6">
      <Link href="/clientes"><Button variant="outline" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button></Link>
      <p className="mt-6 text-brand-lavanda/50">Cliente não encontrado.</p>
    </div>
  )

  return (
    <div>
      <Header title="Editar Cliente" />
      <div className="p-6">
        <PageHeader title="Editar Cliente" description={cliente.nome}>
          <Link href={`/clientes/${id}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </Link>
        </PageHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Informações Pessoais</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input id="nome" placeholder="Nome completo" {...register('nome')} />
                      {errors.nome && <p className="text-xs text-brand-rosa">{errors.nome.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empresa">Empresa</Label>
                      <Input id="empresa" placeholder="Nome da empresa" {...register('empresa')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="email@empresa.com" {...register('email')} />
                      {errors.email && <p className="text-xs text-brand-rosa">{errors.email.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpf_cnpj">CPF / CNPJ</Label>
                      <Input id="cpf_cnpj" placeholder="000.000.000-00" {...register('cpf_cnpj')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input id="telefone" placeholder="(11) 99999-9999" {...register('telefone')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <Input id="whatsapp" placeholder="(11) 99999-9999" {...register('whatsapp')} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-2">
                      <Label htmlFor="endereco">Endereço</Label>
                      <Input id="endereco" placeholder="Rua, número, complemento" {...register('endereco')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input id="cidade" placeholder="São Paulo" {...register('cidade')} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="estado">Estado</Label>
                        <Input id="estado" placeholder="SP" maxLength={2} {...register('estado')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cep">CEP</Label>
                        <Input id="cep" placeholder="00000-000" {...register('cep')} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
                <CardContent>
                  <Textarea placeholder="Notas internas sobre o cliente..." rows={4} {...register('observacoes')} />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Classificação</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      defaultValue={cliente.status}
                      onValueChange={(v) => setValue('status', v as ClienteFormData['status'])}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="prospecto">Prospecto</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Grupo</Label>
                    <Select
                      defaultValue={cliente.tipo ?? 'agencia'}
                      onValueChange={(v) => { setValue('tipo', v as ClienteFormData['tipo']); setValue('produto_id', undefined) }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agencia">Agência</SelectItem>
                        <SelectItem value="saas">SaaS</SelectItem>
                        <SelectItem value="ambos">Agência + SaaS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(tipoValue === 'saas' || tipoValue === 'ambos') && (
                    <div className="space-y-2">
                      <Label>Produto SaaS</Label>
                      <Select
                        defaultValue={cliente.produto_id ?? undefined}
                        onValueChange={(v) => setValue('produto_id', v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                        <SelectContent>
                          {produtos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.cor }} />
                                {p.nome}
                              </span>
                            </SelectItem>
                          ))}
                          {produtos.length === 0 && (
                            <SelectItem value="_none" disabled>Nenhum produto SaaS cadastrado</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Segmento</Label>
                    <Select
                      defaultValue={cliente.segmento ?? undefined}
                      onValueChange={(v) => setValue('segmento', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restaurante">Restaurante</SelectItem>
                        <SelectItem value="moda">Moda</SelectItem>
                        <SelectItem value="tech">Tech</SelectItem>
                        <SelectItem value="saude">Saúde</SelectItem>
                        <SelectItem value="educacao">Educação</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Origem</Label>
                    <Select
                      defaultValue={cliente.origem ?? undefined}
                      onValueChange={(v) => setValue('origem', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Como nos conheceu?" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indicacao">Indicação</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="site">Site</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

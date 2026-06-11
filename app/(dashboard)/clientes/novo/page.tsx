'use client'

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

export default function NovoClientePage() {
  const router = useRouter()
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema) as Resolver<ClienteFormData>,
    defaultValues: { status: 'ativo' },
  })

  async function onSubmit(data: ClienteFormData) {
    const supabase = createClient()
    const { error } = await supabase.from('clientes').insert({
      nome: data.nome,
      empresa: data.empresa ?? null,
      email: data.email ?? null,
      telefone: data.telefone ?? null,
      whatsapp: data.whatsapp ?? null,
      cpf_cnpj: data.cpf_cnpj ?? null,
      endereco: data.endereco ?? null,
      cidade: data.cidade ?? null,
      estado: data.estado ?? null,
      cep: data.cep ?? null,
      segmento: data.segmento ?? null,
      origem: data.origem ?? null,
      status: data.status,
      observacoes: data.observacoes ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    if (!error) router.push('/clientes')
  }

  return (
    <div>
      <Header title="Novo Cliente" />
      <div className="p-6">
        <PageHeader title="Novo Cliente" description="Adicione um novo cliente ao CRM">
          <Link href="/clientes">
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
                    <Select onValueChange={(v) => setValue('status', v as any)} defaultValue="ativo">
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
                    <Label>Segmento</Label>
                    <Select onValueChange={(v) => setValue('segmento', v)}>
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
                    <Select onValueChange={(v) => setValue('origem', v)}>
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
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Cliente'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

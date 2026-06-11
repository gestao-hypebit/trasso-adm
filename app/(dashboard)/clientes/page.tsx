'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Building2, Mail, Phone, MoreHorizontal, Users } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getInitials, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Cliente = Database['public']['Tables']['clientes']['Row']

const statusVariantMap: Record<string, 'ativo' | 'inativo' | 'lead' | 'default'> = {
  ativo: 'ativo', inativo: 'inativo', lead: 'lead', prospecto: 'lead',
}
const statusLabel: Record<string, string> = {
  ativo: 'Ativo', inativo: 'Inativo', lead: 'Lead', prospecto: 'Prospecto',
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })
      setClientes(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = clientes.filter((c) => {
    const matchSearch = !search ||
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.empresa?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div>
      <Header title="Clientes" description="Gerencie seus clientes e leads" />
      <div className="p-6">
        <PageHeader title="Clientes" description={`${filtered.length} clientes encontrados`}>
          <Link href="/clientes/novo">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo Cliente
            </Button>
          </Link>
        </PageHeader>

        <div className="flex flex-col gap-3 mb-6 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
            <Input
              placeholder="Buscar por nome, empresa ou email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {['todos', 'ativo', 'lead', 'prospecto', 'inativo'].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? 'violeta' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="capitalize"
              >
                {s === 'todos' ? 'Todos' : statusLabel[s] || s}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06] mb-4">
              <Users className="h-8 w-8 text-brand-violeta/50" />
            </div>
            <h3 className="text-lg font-semibold text-brand-lavanda">Nenhum cliente encontrado</h3>
            <p className="text-sm text-brand-lavanda/50 mt-1">Tente ajustar os filtros ou adicione um novo cliente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((cliente) => (
              <Card key={cliente.id} className="hover:border-white/[0.12] transition-colors group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-sm">{getInitials(cliente.nome)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <Link href={`/clientes/${cliente.id}`} className="font-semibold text-brand-lavanda hover:text-brand-lima transition-colors">
                          {cliente.nome}
                        </Link>
                        {cliente.empresa && <p className="text-xs text-brand-lavanda/50">{cliente.empresa}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariantMap[cliente.status] || 'default'}>
                        {statusLabel[cliente.status] || cliente.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/clientes/${cliente.id}`}>Ver detalhes</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>Nova interação</DropdownMenuItem>
                          <DropdownMenuItem>Novo projeto</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    {cliente.email && (
                      <div className="flex items-center gap-2 text-xs text-brand-lavanda/60">
                        <Mail className="h-3 w-3 shrink-0" />
                        {cliente.email}
                      </div>
                    )}
                    {cliente.telefone && (
                      <div className="flex items-center gap-2 text-xs text-brand-lavanda/60">
                        <Phone className="h-3 w-3 shrink-0" />
                        {cliente.telefone}
                      </div>
                    )}
                    {cliente.segmento && (
                      <div className="flex items-center gap-2 text-xs text-brand-lavanda/60">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="capitalize">{cliente.segmento}</span>
                      </div>
                    )}
                  </div>

                  {(cliente.tags ?? []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(cliente.tags ?? []).map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-brand-lavanda/70">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mt-3 text-[10px] text-brand-lavanda/30">
                    Cliente desde {formatDate(cliente.created_at, 'MMM yyyy')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

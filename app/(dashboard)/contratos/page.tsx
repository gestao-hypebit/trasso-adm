'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, FileSignature, Upload, MoreHorizontal } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Contrato = {
  id: string
  numero: string
  titulo: string
  tipo: string | null
  status: string
  valor_total: number
  data_inicio: string | null
  data_fim: string | null
  assinado_em: string | null
  clientes: { nome: string } | null
}

const statusConfig = {
  rascunho: { label: 'Rascunho',  variant: 'outline' as const },
  enviado:  { label: 'Enviado',   variant: 'default' as const },
  assinado: { label: 'Assinado',  variant: 'aprovada' as const },
  encerrado:{ label: 'Encerrado', variant: 'inativo' as const },
  cancelado:{ label: 'Cancelado', variant: 'recusada' as const },
}

const tipoConfig: Record<string, string> = {
  servico: 'Serviço', retainer: 'Retainer', pontual: 'Pontual', parceria: 'Parceria',
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data } = await supabase
        .from('contratos')
        .select('id, numero, titulo, tipo, status, valor_total, data_inicio, data_fim, assinado_em, clientes(nome)')
        .order('created_at', { ascending: false })
      setContratos((data as Contrato[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const contratosFiltrados = contratos.filter((c) => {
    const matchBusca = c.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (c.clientes?.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
      c.numero.toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus
    return matchBusca && matchStatus
  })

  const totalAtivo = contratos.filter(c => c.status === 'assinado').reduce((s, c) => s + c.valor_total, 0)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Contratos" description="Gestão de contratos" />

      <main className="flex-1 p-6">
        <PageHeader title="Contratos" description={`${contratos.filter(c => c.status === 'assinado').length} ativos • ${formatCurrency(totalAtivo)} em vigor`}>
          <Button>
            <Plus className="h-4 w-4" />
            Novo Contrato
          </Button>
        </PageHeader>

        {!loading && (
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(statusConfig).map(([key, sc]) => {
              const count = contratos.filter(c => c.status === key).length
              if (count === 0) return null
              return (
                <button
                  key={key}
                  onClick={() => setFiltroStatus(filtroStatus === key ? 'todos' : key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    filtroStatus === key
                      ? 'border-brand-lima bg-brand-lima/20 text-brand-lima'
                      : 'border-white/[0.1] bg-white/[0.04] text-brand-lavanda/70 hover:border-white/[0.2] hover:text-brand-lavanda'
                  )}
                >
                  {sc.label}
                  <span className="rounded-full bg-white/[0.02] px-1.5">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
            <Input
              className="pl-9"
              placeholder="Buscar contrato, cliente ou número..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              {Object.entries(statusConfig).map(([key, sc]) => (
                <SelectItem key={key} value={key}>{sc.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Número / Título</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Cliente</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Tipo</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Valor</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Vigência</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Status</th>
                    <th className="text-center text-xs text-brand-lavanda/50 font-medium px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="px-6 py-16 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                  ) : contratosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <FileSignature className="h-10 w-10 text-brand-lavanda/20 mx-auto mb-3" />
                        <p className="text-brand-lavanda/40 text-sm">Nenhum contrato encontrado.</p>
                      </td>
                    </tr>
                  ) : contratosFiltrados.map((c) => {
                    const sc = statusConfig[c.status as keyof typeof statusConfig]
                    return (
                      <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-3.5">
                          <Link href={`/contratos/${c.id}`} className="hover:text-brand-lima transition-colors">
                            <p className="font-mono text-xs text-brand-lavanda/50 mb-0.5">{c.numero}</p>
                            <p className="font-medium text-brand-lavanda group-hover:text-brand-lima transition-colors truncate max-w-xs">{c.titulo}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-brand-lavanda/70 whitespace-nowrap">{c.clientes?.nome ?? '—'}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-brand-lavanda/60">{c.tipo ? (tipoConfig[c.tipo] ?? c.tipo) : '—'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-brand-lavanda whitespace-nowrap">
                          {formatCurrency(c.valor_total)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-brand-lavanda/60 whitespace-nowrap">
                          {c.data_inicio ? formatDate(c.data_inicio) : '—'}
                          {c.data_fim ? ` → ${formatDate(c.data_fim)}` : c.data_inicio ? ' → vigente' : ''}
                        </td>
                        <td className="px-4 py-3.5">
                          {sc && <Badge variant={sc.variant}>{sc.label}</Badge>}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/contratos/${c.id}`}>Visualizar</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Upload className="h-3.5 w-3.5 mr-2" />
                                Enviar PDF assinado
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

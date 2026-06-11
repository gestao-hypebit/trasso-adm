'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Copy, FileCheck, MoreHorizontal, FileText } from 'lucide-react'
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

type Proposta = {
  id: string
  numero: string
  titulo: string
  status: string
  validade: string | null
  valor_total: number
  desconto_percentual: number
  valor_final: number
  created_at: string
  clientes: { nome: string } | null
}

const statusConfig = {
  rascunho:      { label: 'Rascunho',      variant: 'outline' as const,     cor: 'text-brand-lavanda/60' },
  enviada:       { label: 'Enviada',        variant: 'default' as const,     cor: 'text-brand-lavanda' },
  em_negociacao: { label: 'Em Negociação',  variant: 'pendente' as const,    cor: 'text-yellow-400' },
  aprovada:      { label: 'Aprovada',       variant: 'aprovada' as const,    cor: 'text-brand-lima' },
  recusada:      { label: 'Recusada',       variant: 'recusada' as const,    cor: 'text-brand-rosa' },
  expirada:      { label: 'Expirada',       variant: 'inativo' as const,     cor: 'text-brand-lavanda/40' },
}

export default function PropostasPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data } = await supabase
        .from('propostas')
        .select('id, numero, titulo, status, validade, valor_total, desconto_percentual, valor_final, created_at, clientes(nome)')
        .order('created_at', { ascending: false })
      setPropostas((data as Proposta[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const propostasFiltradas = propostas.filter((p) => {
    const matchBusca = p.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (p.clientes?.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
      p.numero.toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
    return matchBusca && matchStatus
  })

  const totalEmAberto = propostas
    .filter(p => ['enviada', 'em_negociacao'].includes(p.status))
    .reduce((s, p) => s + p.valor_final, 0)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Propostas" description="Pipeline comercial" />

      <main className="flex-1 p-6">
        <PageHeader title="Propostas" description={`${propostas.length} propostas • ${formatCurrency(totalEmAberto)} em aberto`}>
          <Link href="/propostas/nova">
            <Button>
              <Plus className="h-4 w-4" />
              Nova Proposta
            </Button>
          </Link>
        </PageHeader>

        {!loading && (
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(statusConfig).map(([key, sc]) => {
              const count = propostas.filter(p => p.status === key).length
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
              placeholder="Buscar proposta, cliente ou número..."
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
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Valor</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Validade</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Status</th>
                    <th className="text-center text-xs text-brand-lavanda/50 font-medium px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-16 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                  ) : propostasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <FileText className="h-10 w-10 text-brand-lavanda/20 mx-auto mb-3" />
                        <p className="text-brand-lavanda/40 text-sm">Nenhuma proposta encontrada.</p>
                      </td>
                    </tr>
                  ) : propostasFiltradas.map((p) => {
                    const sc = statusConfig[p.status as keyof typeof statusConfig]
                    return (
                      <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-3.5">
                          <Link href={`/propostas/${p.id}`} className="hover:text-brand-lima transition-colors">
                            <p className="font-mono text-xs text-brand-lavanda/50 mb-0.5">{p.numero}</p>
                            <p className="font-medium text-brand-lavanda group-hover:text-brand-lima transition-colors">{p.titulo}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-brand-lavanda/70 whitespace-nowrap">{p.clientes?.nome ?? '—'}</td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <p className="font-semibold text-brand-lavanda">{formatCurrency(p.valor_final)}</p>
                          {p.desconto_percentual > 0 && (
                            <p className="text-xs text-brand-lavanda/40 line-through">{formatCurrency(p.valor_total)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-brand-lavanda/60 text-xs whitespace-nowrap">
                          {p.validade ? formatDate(p.validade) : '—'}
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
                                <Link href={`/propostas/${p.id}`}>Visualizar</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Copy className="h-3.5 w-3.5 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              {p.status === 'aprovada' && (
                                <DropdownMenuItem>
                                  <FileCheck className="h-3.5 w-3.5 mr-2" />
                                  Converter em Contrato
                                </DropdownMenuItem>
                              )}
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

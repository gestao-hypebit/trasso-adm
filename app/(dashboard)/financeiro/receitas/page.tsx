'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, TrendingUp, CheckCircle2, Clock, XCircle, Download, Layers, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LancamentoForm } from '@/components/financeiro/lancamento-form'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Lancamento = {
  id: string; descricao: string; valor: number; data: string
  status: string; forma_pagamento: string | null; recorrente: boolean; frequencia: string | null
  categorias_financeiras: { nome: string } | null
  clientes: { nome: string } | null
}

type ProdutoMrr = { id: string; nome: string; cor: string; mrr: number; clientes: number }

type Serie = {
  key: string
  descricao: string
  cliente: string | null
  valor: number
  frequencia: string
  entradas: Lancamento[]
}

const subNav = [
  { href: '/financeiro', label: 'Visão Geral' },
  { href: '/financeiro/receitas', label: 'Receitas' },
  { href: '/financeiro/despesas', label: 'Despesas' },
  { href: '/financeiro/fluxo-de-caixa', label: 'Fluxo de Caixa' },
]

const statusConfig = {
  recebido: { label: 'Recebido', variant: 'concluido' as const, icon: CheckCircle2 },
  pendente: { label: 'Pendente', variant: 'pendente' as const, icon: Clock },
  cancelado: { label: 'Cancelado', variant: 'inativo' as const, icon: XCircle },
}

const frequenciaLabel: Record<string, string> = {
  mensal: 'Mensal', quinzenal: 'Quinzenal', semanal: 'Semanal', anual: 'Anual',
}

function FinanceiroSubNav({ pathname }: { pathname: string }) {
  return (
    <div className="flex gap-1 border-b border-white/[0.06] mb-6">
      {subNav.map(({ href, label }) => (
        <Link key={href} href={href} className={cn(
          'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
          pathname === href ? 'border-brand-lima text-brand-lima' : 'border-transparent text-brand-lavanda/60 hover:text-brand-lavanda hover:border-white/[0.12]'
        )}>{label}</Link>
      ))}
    </div>
  )
}

function groupBySerie(lancamentos: Lancamento[]): Serie[] {
  const map = new Map<string, Serie>()
  for (const l of lancamentos) {
    const key = `${l.descricao}||${l.clientes?.nome ?? ''}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        descricao: l.descricao,
        cliente: l.clientes?.nome ?? null,
        valor: l.valor,
        frequencia: l.frequencia ?? 'mensal',
        entradas: [],
      })
    }
    map.get(key)!.entradas.push(l)
  }
  return Array.from(map.values())
    .map(s => ({ ...s, entradas: s.entradas.sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => a.descricao.localeCompare(b.descricao))
}

export default function ReceitasPage() {
  const pathname = usePathname()
  const [receitas, setReceitas] = useState<Lancamento[]>([])
  const [recorrentes, setRecorrentes] = useState<Lancamento[]>([])
  const [produtosMrr, setProdutosMrr] = useState<ProdutoMrr[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const supabase = createClient()
    const db = supabase as any

    const [receitasRes, recorrentesRes, prodsRes] = await Promise.all([
      supabase
        .from('lancamentos')
        .select('id, descricao, valor, data, status, forma_pagamento, recorrente, frequencia, categorias_financeiras(nome), clientes(nome)')
        .eq('tipo', 'receita')
        .eq('recorrente', false)
        .order('data', { ascending: false }),
      supabase
        .from('lancamentos')
        .select('id, descricao, valor, data, status, forma_pagamento, recorrente, frequencia, categorias_financeiras(nome), clientes(nome)')
        .eq('tipo', 'receita')
        .eq('recorrente', true)
        .order('data', { ascending: true }),
      db.from('produtos').select('id, nome, cor').eq('ativo', true),
    ])

    setReceitas((receitasRes.data as Lancamento[]) ?? [])
    setRecorrentes((recorrentesRes.data as Lancamento[]) ?? [])

    if (prodsRes.data?.length) {
      const mrrList: ProdutoMrr[] = []
      for (const p of prodsRes.data) {
        const { data: clientes } = await db
          .from('saas_clientes').select('mrr').eq('produto_id', p.id).in('status', ['ativo', 'trial'])
        mrrList.push({
          id: p.id, nome: p.nome, cor: p.cor,
          mrr: Math.round((clientes ?? []).reduce((s: number, c: any) => s + (c.mrr ?? 0), 0) * 100) / 100,
          clientes: (clientes ?? []).length,
        })
      }
      setProdutosMrr(mrrList)
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function confirmarRecebimento(id: string) {
    const { error } = await (createClient() as any).from('lancamentos').update({ status: 'recebido' }).eq('id', id)
    if (!error) setRecorrentes(prev => prev.map(l => l.id === id ? { ...l, status: 'recebido' } : l))
  }

  const filtradas = receitas.filter((r) => {
    const matchBusca = r.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      (r.clientes?.nome ?? '').toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || r.status === filtroStatus
    return matchBusca && matchStatus
  })

  const totalRecebido = filtradas.filter(r => r.status === 'recebido').reduce((s, r) => s + r.valor, 0)
  const totalPendente = filtradas.filter(r => r.status === 'pendente').reduce((s, r) => s + r.valor, 0)
  const mrrSaas = produtosMrr.reduce((s, p) => s + p.mrr, 0)
  const series = groupBySerie(recorrentes)

  // Recorrentes stats for this month
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const recorrentesMes = recorrentes.filter(l => l.data.startsWith(mesAtual))
  const recorrentesRecebidosMes = recorrentesMes.filter(l => l.status === 'recebido').reduce((s, l) => s + l.valor, 0)
  const recorrentesPendentesMes = recorrentesMes.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor, 0)

  function toggleSerie(key: string) {
    setExpandedSeries(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Receitas da agência" />
      <main className="flex-1 p-6">
        <PageHeader title="Financeiro" description="Receitas">
          <LancamentoForm defaultTipo="receita" onSuccess={load} />
        </PageHeader>
        <FinanceiroSubNav pathname={pathname} />

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Agência Recebido', valor: totalRecebido, cor: 'text-brand-lima', icon: CheckCircle2, bg: 'bg-brand-lima/10' },
            { label: 'A Receber (Pendente)', valor: totalPendente, cor: 'text-yellow-400', icon: Clock, bg: 'bg-yellow-400/10' },
            { label: 'MRR SaaS', valor: mrrSaas, cor: 'text-brand-violeta', icon: Layers, bg: 'bg-brand-violeta/10' },
            { label: 'Total Consolidado', valor: totalRecebido + mrrSaas, cor: 'text-brand-lima', icon: TrendingUp, bg: 'bg-brand-lima/10' },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', item.bg)}>
                  <item.icon className={cn('h-5 w-5', item.cor)} />
                </div>
                <div>
                  <p className={cn('text-xl font-bold', item.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {formatCurrency(item.valor)}
                  </p>
                  <p className="text-xs text-brand-lavanda/50">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Seção Recorrentes */}
        {series.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-brand-violeta" />
                  <CardTitle className="text-base">Receitas Recorrentes</CardTitle>
                </div>
                <div className="flex items-center gap-4 text-xs text-brand-lavanda/50">
                  <span>Este mês: <span className="text-brand-lima font-medium">{formatCurrency(recorrentesRecebidosMes)}</span> recebido</span>
                  {recorrentesPendentesMes > 0 && (
                    <span>· <span className="text-yellow-400 font-medium">{formatCurrency(recorrentesPendentesMes)}</span> pendente</span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {series.map((serie) => {
                const expanded = expandedSeries.has(serie.key)
                const recebidos = serie.entradas.filter(e => e.status === 'recebido').length
                const pendentes = serie.entradas.filter(e => e.status === 'pendente').length
                const proxPendente = serie.entradas.find(e => e.status === 'pendente')

                return (
                  <div key={serie.key} className="border-b border-white/[0.04] last:border-0">
                    {/* Linha da série */}
                    <button
                      type="button"
                      onClick={() => toggleSerie(serie.key)}
                      className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
                    >
                      {expanded
                        ? <ChevronDown className="h-4 w-4 text-brand-lavanda/40 shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-brand-lavanda/40 shrink-0" />
                      }
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-violeta/10">
                        <RefreshCw className="h-3.5 w-3.5 text-brand-violeta" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-brand-lavanda font-medium truncate">{serie.descricao}</p>
                        <p className="text-xs text-brand-lavanda/40 mt-0.5">
                          {serie.cliente ?? '—'} · {frequenciaLabel[serie.frequencia] ?? serie.frequencia}
                          · {recebidos}/{serie.entradas.length} recebidos
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-brand-lima">{formatCurrency(serie.valor)}</p>
                        <p className="text-xs text-brand-lavanda/40">/entrada</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0 ml-2">
                        {recebidos > 0 && <Badge variant="concluido">{recebidos} rec.</Badge>}
                        {pendentes > 0 && <Badge variant="pendente">{pendentes} pend.</Badge>}
                      </div>
                    </button>

                    {/* Próxima pendente (sempre visível) */}
                    {!expanded && proxPendente && (
                      <div className="px-6 pb-3 pl-[72px] flex items-center justify-between">
                        <p className="text-xs text-brand-lavanda/40">
                          Próxima: <span className="text-yellow-400">{formatDate(proxPendente.data)}</span>
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-brand-lima/30 text-brand-lima hover:bg-brand-lima/10"
                          onClick={(e) => { e.stopPropagation(); confirmarRecebimento(proxPendente.id) }}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Confirmar recebimento
                        </Button>
                      </div>
                    )}

                    {/* Entradas expandidas */}
                    {expanded && (
                      <div className="bg-white/[0.01] border-t border-white/[0.04]">
                        {serie.entradas.map((entrada) => (
                          <div key={entrada.id} className="flex items-center gap-3 px-6 py-2.5 pl-[72px] border-b border-white/[0.03] last:border-0">
                            <div className="flex-1">
                              <span className="text-xs text-brand-lavanda/60">{formatDate(entrada.data)}</span>
                            </div>
                            <span className="text-xs font-medium text-brand-lima">{formatCurrency(entrada.valor)}</span>
                            <div className="w-28 flex justify-end">
                              {entrada.status === 'pendente' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] px-2 border-brand-lima/30 text-brand-lima hover:bg-brand-lima/10"
                                  onClick={() => confirmarRecebimento(entrada.id)}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Confirmar
                                </Button>
                              ) : (
                                <Badge variant={statusConfig[entrada.status as keyof typeof statusConfig]?.variant ?? 'outline'}>
                                  {statusConfig[entrada.status as keyof typeof statusConfig]?.label ?? entrada.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Filtros e tabela de lançamentos avulsos */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
            <Input className="pl-9" placeholder="Buscar receita ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="recebido">Recebido</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon"><Download className="h-4 w-4" /></Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Descrição</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Cliente</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Categoria</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Data</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Pagamento</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Valor</th>
                    <th className="text-center text-xs text-brand-lavanda/50 font-medium px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                  ) : filtradas.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Nenhuma receita encontrada.</td></tr>
                  ) : filtradas.map((r) => {
                    const sc = statusConfig[r.status as keyof typeof statusConfig]
                    return (
                      <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="text-brand-lavanda font-medium truncate max-w-xs">{r.descricao}</p>
                        </td>
                        <td className="px-4 py-3.5 text-brand-lavanda/70 whitespace-nowrap">{r.clientes?.nome ?? '—'}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-brand-lavanda/60">{r.categorias_financeiras?.nome ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-brand-lavanda/60 whitespace-nowrap text-xs">{formatDate(r.data)}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-brand-lavanda/50 capitalize">{(r.forma_pagamento ?? '—').replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-brand-lima whitespace-nowrap">{formatCurrency(r.valor)}</td>
                        <td className="px-4 py-3.5 text-center">
                          {sc && <Badge variant={sc.variant}>{sc.label}</Badge>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {filtradas.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-white/[0.06]">
                      <td colSpan={5} className="px-6 py-3 text-xs text-brand-lavanda/40">
                        {filtradas.length} lançamento{filtradas.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-brand-lavanda whitespace-nowrap">
                        {formatCurrency(filtradas.reduce((s, r) => s + r.valor, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>

        {/* SaaS MRR */}
        {produtosMrr.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Receitas Recorrentes SaaS</CardTitle>
                <span className="text-xs text-brand-lavanda/50">MRR mensal consolidado</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/[0.04]">
                {produtosMrr.map(p => (
                  <Link key={p.id} href={`/saas/${p.id}`}>
                    <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-violeta/10">
                        <Layers className="h-4 w-4 text-brand-violeta" />
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.cor }} />
                        <div>
                          <p className="text-sm text-brand-lavanda font-medium">{p.nome}</p>
                          <p className="text-xs text-brand-lavanda/40">{p.clientes} assinante{p.clientes !== 1 ? 's' : ''} ativos</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-brand-lima">+{formatCurrency(p.mrr)}</p>
                        <p className="text-xs text-brand-lavanda/40">MRR</p>
                      </div>
                      <Badge variant="concluido">Recorrente</Badge>
                    </div>
                  </Link>
                ))}
                <div className="flex items-center justify-between px-6 py-3.5 bg-brand-lima/[0.03]">
                  <span className="text-xs font-medium text-brand-lima/70">Total MRR SaaS</span>
                  <span className="text-sm font-bold text-brand-lima">+{formatCurrency(mrrSaas)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

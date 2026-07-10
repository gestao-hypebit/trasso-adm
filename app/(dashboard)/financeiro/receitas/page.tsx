'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Search, TrendingUp, CheckCircle2, Clock, XCircle, Download, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LancamentoForm } from '@/components/financeiro/lancamento-form'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Lancamento = {
  id: string; descricao: string; valor: number; data: string
  status: string; forma_pagamento: string | null; recorrente: boolean; frequencia: string | null
  categorias_financeiras: { nome: string } | null
  clientes: { nome: string } | null
}

type Serie = {
  key: string
  descricao: string
  cliente: string | null
  valor: number
  frequencia: string
  entradas: Lancamento[]
}

const statusConfig = {
  recebido: { label: 'Recebido', variant: 'concluido' as const, icon: CheckCircle2 },
  pendente: { label: 'Pendente', variant: 'pendente' as const, icon: Clock },
  cancelado: { label: 'Cancelado', variant: 'inativo' as const, icon: XCircle },
}

const frequenciaLabel: Record<string, string> = {
  mensal: 'Mensal', quinzenal: 'Quinzenal', semanal: 'Semanal', anual: 'Anual',
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
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mesSel, setMesSel] = useState(() => startOfMonth(new Date()))
  const [allTime, setAllTime] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear())
  const mesStart = allTime ? '0000-01-01' : format(mesSel, 'yyyy-MM-01')
  const mesEnd = allTime ? '9999-12-31' : format(endOfMonth(mesSel), 'yyyy-MM-dd')
  const mesLabel = allTime ? 'Desde o início' : format(mesSel, 'MMMM yyyy', { locale: ptBR })
  const isCurrentMes = !allTime && format(mesSel, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  const load = useCallback(async () => {
    const supabase = createClient()

    const [receitasRes, recorrentesRes] = await Promise.all([
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
    ])

    setReceitas((receitasRes.data as Lancamento[]) ?? [])
    setRecorrentes((recorrentesRes.data as Lancamento[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteLancamento(id: string) {
    const { error } = await createClient().from('lancamentos').delete().eq('id', id)
    if (!error) {
      setReceitas(prev => prev.filter(r => r.id !== id))
      setRecorrentes(prev => prev.filter(r => r.id !== id))
    }
    setDeletingId(null)
  }

  async function confirmarRecebimento(id: string) {
    const { error } = await (createClient() as any).from('lancamentos').update({ status: 'recebido' }).eq('id', id)
    if (!error) setRecorrentes(prev => prev.map(l => l.id === id ? { ...l, status: 'recebido' } : l))
  }

  const filtradas = receitas.filter((r) => {
    const matchBusca = r.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      (r.clientes?.nome ?? '').toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || r.status === filtroStatus
    const matchData = r.data >= mesStart && r.data <= mesEnd
    return matchBusca && matchStatus && matchData
  })

  const totalRecebido = filtradas.filter(r => r.status === 'recebido').reduce((s, r) => s + r.valor, 0)
  const totalPendente = filtradas.filter(r => r.status === 'pendente').reduce((s, r) => s + r.valor, 0)
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
            { label: 'Recebido', valor: totalRecebido, cor: 'text-brand-lima', icon: CheckCircle2, bg: 'bg-brand-lima/10' },
            { label: 'A Receber (Pendente)', valor: totalPendente, cor: 'text-yellow-400', icon: Clock, bg: 'bg-yellow-400/10' },
            { label: 'Total Lançamentos', valor: totalRecebido + totalPendente, cor: 'text-brand-violeta', icon: TrendingUp, bg: 'bg-brand-violeta/10' },
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
                          <div key={entrada.id} className="flex items-center gap-3 px-6 py-2.5 pl-[72px] border-b border-white/[0.03] last:border-0 group">
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
                            <div className="w-16 flex justify-end shrink-0">
                              {deletingId === entrada.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => deleteLancamento(entrada.id)} className="text-[11px] text-brand-rosa font-medium">Excluir</button>
                                  <span className="text-brand-lavanda/20">·</span>
                                  <button onClick={() => setDeletingId(null)} className="text-[11px] text-brand-lavanda/40">Cancelar</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingId(entrada.id)}
                                  className="flex h-6 w-6 items-center justify-center rounded text-brand-lavanda/0 group-hover:text-brand-lavanda/25 hover:!text-brand-rosa hover:bg-brand-rosa/10 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
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
        <div className="flex items-center gap-3 mb-4">
          {!allTime && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <button onClick={() => setMesSel(d => subMonths(d, 1))} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="relative">
                <button onClick={() => { setPickerYear(mesSel.getFullYear()); setShowPicker(v => !v) }} className="flex items-center gap-1 text-sm font-medium text-brand-lavanda min-w-[130px] justify-center capitalize hover:text-brand-lavanda/80 transition-colors">
                  {mesLabel}
                  <ChevronDown className="h-3 w-3 text-brand-lavanda/40 shrink-0" />
                </button>
                {showPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 rounded-xl border border-white/[0.1] bg-[#1A0533] shadow-2xl p-3 w-56">
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={() => setPickerYear(y => y - 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></button>
                        <span className="text-sm font-semibold text-brand-lavanda">{pickerYear}</span>
                        <button onClick={() => setPickerYear(y => y + 1)} disabled={pickerYear >= new Date().getFullYear()} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"><ChevronRight className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {Array.from({ length: 12 }, (_, i) => {
                          const d = new Date(pickerYear, i, 1)
                          const isSelected = format(d, 'yyyy-MM') === format(mesSel, 'yyyy-MM')
                          const isFuture = d > new Date()
                          const lbl = format(d, 'MMM', { locale: ptBR })
                          return (
                            <button key={i} disabled={isFuture} onClick={() => { setMesSel(startOfMonth(d)); setAllTime(false); setShowPicker(false) }} className={cn('py-1.5 rounded-lg text-xs transition-colors capitalize', isSelected ? 'bg-brand-lima text-brand-noite font-semibold' : 'text-brand-lavanda/60 hover:bg-white/[0.06] hover:text-brand-lavanda', isFuture && 'opacity-25 cursor-not-allowed')}>
                              {lbl.charAt(0).toUpperCase() + lbl.slice(1, 3)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setMesSel(d => addMonths(d, 1))} disabled={isCurrentMes} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {allTime && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-lima/30 bg-brand-lima/[0.04] px-4 py-2">
              <span className="text-sm font-medium text-brand-lima">Desde o início</span>
            </div>
          )}
          <button onClick={() => setAllTime(v => !v)} className={cn('text-xs px-3 py-1.5 rounded-lg border transition-colors', allTime ? 'border-brand-lima/30 text-brand-lima bg-brand-lima/[0.08] hover:bg-brand-lima/[0.12]' : 'border-white/[0.08] text-brand-lavanda/40 hover:text-brand-lavanda/70 hover:border-white/[0.14]')}>
            {allTime ? 'Ver por mês' : 'Desde o início'}
          </button>
          {!allTime && !isCurrentMes && (
            <button onClick={() => setMesSel(startOfMonth(new Date()))} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 transition-colors">Mês atual</button>
          )}
        </div>

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
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                  ) : filtradas.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Nenhuma receita encontrada.</td></tr>
                  ) : filtradas.map((r) => {
                    const sc = statusConfig[r.status as keyof typeof statusConfig]
                    return (
                      <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
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
                        <td className="px-2 py-3.5 text-center">
                          {deletingId === r.id ? (
                            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                              <button onClick={() => deleteLancamento(r.id)} className="text-xs text-brand-rosa hover:text-brand-rosa/80 font-medium transition-colors">Excluir</button>
                              <span className="text-brand-lavanda/20">·</span>
                              <button onClick={() => setDeletingId(null)} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 transition-colors">Cancelar</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(r.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-brand-lavanda/0 group-hover:text-brand-lavanda/25 hover:!text-brand-rosa hover:bg-brand-rosa/10 transition-colors mx-auto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
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
                      <td /><td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  )
}

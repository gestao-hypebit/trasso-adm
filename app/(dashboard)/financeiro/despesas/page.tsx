'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Search, TrendingDown, CheckCircle2, Clock, Download, Trash2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
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
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Lancamento = {
  id: string; descricao: string; valor: number; data: string
  status: string; forma_pagamento: string | null
  categorias_financeiras: { nome: string } | null
}

const statusConfig = {
  pago: { label: 'Pago', variant: 'concluido' as const },
  pendente: { label: 'Pendente', variant: 'pendente' as const },
  cancelado: { label: 'Cancelado', variant: 'inativo' as const },
}

const CORES = ['#7C3AED', '#FF4D8D', '#B8F000', '#F59E0B', '#06B6D4', '#5B21B6', '#10B981']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl">
      <p className="font-semibold text-brand-lavanda">{payload[0].name}</p>
      <p style={{ color: payload[0].payload.fill }}>{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function DespesasPage() {
  const pathname = usePathname()
  const [despesas, setDespesas] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
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
    const { data } = await supabase
      .from('lancamentos')
      .select('id, descricao, valor, data, status, forma_pagamento, categorias_financeiras(nome)')
      .eq('tipo', 'despesa')
      .order('data', { ascending: false })
    setDespesas((data as Lancamento[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteLancamento(id: string) {
    const { error } = await createClient().from('lancamentos').delete().eq('id', id)
    if (!error) setDespesas(prev => prev.filter(d => d.id !== id))
    setDeletingId(null)
  }

  const filtradas = despesas.filter((d) => {
    const matchBusca = d.descricao.toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || d.status === filtroStatus
    const matchData = d.data >= mesStart && d.data <= mesEnd
    return matchBusca && matchStatus && matchData
  })

  const totalPago = filtradas.filter(d => d.status === 'pago').reduce((s, d) => s + d.valor, 0)
  const totalPendente = filtradas.filter(d => d.status === 'pendente').reduce((s, d) => s + d.valor, 0)

  const porCategoria = Object.entries(
    filtradas.reduce((acc, d) => {
      const nome = d.categorias_financeiras?.nome ?? 'Outros'
      acc[nome] = (acc[nome] || 0) + d.valor
      return acc
    }, {} as Record<string, number>)
  ).map(([name, value], i) => ({ name, value, fill: CORES[i % CORES.length] }))

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Despesas da agência" />
      <main className="flex-1 p-6">
        <PageHeader title="Financeiro" description="Despesas">
          <LancamentoForm defaultTipo="despesa" />
        </PageHeader>
        <FinanceiroSubNav pathname={pathname} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="space-y-4">
            {[
              { label: 'Total Pago', valor: totalPago, cor: 'text-brand-rosa', icon: CheckCircle2, bg: 'bg-brand-rosa/10' },
              { label: 'A Pagar (Pendente)', valor: totalPendente, cor: 'text-yellow-400', icon: Clock, bg: 'bg-yellow-400/10' },
              { label: 'Total Geral', valor: totalPago + totalPendente, cor: 'text-brand-lavanda', icon: TrendingDown, bg: 'bg-brand-violeta/10' },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', item.bg)}>
                    <item.icon className={cn('h-5 w-5', item.cor)} />
                  </div>
                  <div>
                    <p className={cn('text-lg font-bold', item.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                      {formatCurrency(item.valor)}
                    </p>
                    <p className="text-xs text-brand-lavanda/50">{item.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base">Despesas por Categoria</CardTitle></CardHeader>
            <CardContent>
              {porCategoria.length === 0 ? (
                <p className="text-xs text-brand-lavanda/40 text-center py-12">Sem dados para exibir.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={porCategoria} cx="40%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                      {porCategoria.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="transparent" />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value) => (
                      <span className="text-xs text-brand-lavanda/70">{value}</span>
                    )} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

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
                        <button onClick={() => setPickerYear(y => y + 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"><ChevronRight className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {Array.from({ length: 12 }, (_, i) => {
                          const d = new Date(pickerYear, i, 1)
                          const isSelected = format(d, 'yyyy-MM') === format(mesSel, 'yyyy-MM')
                          const lbl = format(d, 'MMM', { locale: ptBR })
                          return (
                            <button key={i} onClick={() => { setMesSel(startOfMonth(d)); setAllTime(false); setShowPicker(false) }} className={cn('py-1.5 rounded-lg text-xs transition-colors capitalize', isSelected ? 'bg-brand-lima text-brand-noite font-semibold' : 'text-brand-lavanda/60 hover:bg-white/[0.06] hover:text-brand-lavanda')}>
                              {lbl.charAt(0).toUpperCase() + lbl.slice(1, 3)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setMesSel(d => addMonths(d, 1))} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
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
            <Input className="pl-9" placeholder="Buscar despesa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon"><Download className="h-4 w-4" /></Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Descrição</th>
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
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                  ) : filtradas.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Nenhuma despesa encontrada.</td></tr>
                  ) : filtradas.map((d) => {
                    const sc = statusConfig[d.status as keyof typeof statusConfig]
                    const cor = CORES[porCategoria.findIndex(c => c.name === (d.categorias_financeiras?.nome ?? 'Outros')) % CORES.length] || CORES[0]
                    return (
                      <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-3.5">
                          <p className="text-brand-lavanda font-medium">{d.descricao}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-xs text-brand-lavanda/60">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                            {d.categorias_financeiras?.nome ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-brand-lavanda/60 whitespace-nowrap text-xs">{formatDate(d.data)}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-brand-lavanda/50 capitalize">{(d.forma_pagamento ?? '—').replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-brand-rosa whitespace-nowrap">{formatCurrency(d.valor)}</td>
                        <td className="px-4 py-3.5 text-center">
                          {sc && <Badge variant={sc.variant}>{sc.label}</Badge>}
                        </td>
                        <td className="px-2 py-3.5 text-center">
                          {deletingId === d.id ? (
                            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                              <button onClick={() => deleteLancamento(d.id)} className="text-xs text-brand-rosa hover:text-brand-rosa/80 font-medium transition-colors">Excluir</button>
                              <span className="text-brand-lavanda/20">·</span>
                              <button onClick={() => setDeletingId(null)} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 transition-colors">Cancelar</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(d.id)}
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
                      <td colSpan={4} className="px-6 py-3 text-xs text-brand-lavanda/40">
                        {filtradas.length} lançamento{filtradas.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-brand-lavanda whitespace-nowrap">
                        {formatCurrency(filtradas.reduce((s, d) => s + d.valor, 0))}
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

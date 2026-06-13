'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, TrendingDown, Clock, DollarSign, ChevronLeft, ChevronRight, ChevronDown, Wallet, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LancamentoForm } from '@/components/financeiro/lancamento-form'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Lancamento = {
  id: string; tipo: string; descricao: string; valor: number; data: string; status: string
  forma_pagamento: string | null
  categorias_financeiras: { nome: string } | null
  clientes: { nome: string } | null
}

type DiaFluxo ={ dia: string; entradas: number; saidas: number; saldo: number }

const subNav = [
  { href: '/financeiro', label: 'Visão Geral' },
  { href: '/financeiro/receitas', label: 'Receitas' },
  { href: '/financeiro/despesas', label: 'Despesas' },
  { href: '/financeiro/fluxo-de-caixa', label: 'Fluxo de Caixa' },
]

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl">
      <p className="text-brand-lavanda/60 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">{formatCurrency(p.value)}</p>
      ))}
    </div>
  )
}

export default function FinanceiroPage() {
  const pathname = usePathname()
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)

  const [mesSel, setMesSel] = useState(() => startOfMonth(new Date()))
  const [allTime, setAllTime] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear())
  const mesStart = allTime ? '0000-01-01' : format(mesSel, 'yyyy-MM-01')
  const mesEnd = allTime ? '9999-12-31' : format(endOfMonth(mesSel), 'yyyy-MM-dd')
  const mesLabel = allTime ? 'Desde o início' : format(mesSel, 'MMMM yyyy', { locale: ptBR })
  const isCurrentMes = !allTime && format(mesSel, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('lancamentos')
      .select('id, tipo, descricao, valor, data, status, forma_pagamento, categorias_financeiras(nome), clientes(nome)')
      .order('data', { ascending: false })
    setLancamentos((data as Lancamento[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteLancamento(id: string) {
    const { error } = await createClient().from('lancamentos').delete().eq('id', id)
    if (!error) setLancamentos(prev => prev.filter(l => l.id !== id))
    setDeletingId(null)
  }

  const doMes = lancamentos.filter(l => l.data >= mesStart && l.data <= mesEnd)
  const receitasMes = doMes.filter(l => l.tipo === 'receita')
  const despesasMes = doMes.filter(l => l.tipo === 'despesa')
  const totalReceitas = receitasMes.filter(l => l.status === 'recebido').reduce((s, l) => s + l.valor, 0)
  const totalDespesas = despesasMes.filter(l => l.status === 'pago').reduce((s, l) => s + l.valor, 0)
  const aReceber = receitasMes.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor, 0)
  const aPagar = despesasMes.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor, 0)

  const saldoAtual = lancamentos.reduce((s, l) => {
    if (l.tipo === 'receita' && l.status === 'recebido') return s + l.valor
    if (l.tipo === 'despesa' && l.status === 'pago') return s - l.valor
    return s
  }, 0)

  const cashflowData: DiaFluxo[] = (() => {
    if (allTime) {
      const porMes: Record<string, { entradas: number; saidas: number }> = {}
      for (const l of [...lancamentos].sort((a, b) => a.data.localeCompare(b.data))) {
        const k = l.data.slice(0, 7)
        const lbl = format(new Date(k + '-01T12:00:00Z'), 'MMM/yy', { locale: ptBR })
        const label = lbl.charAt(0).toUpperCase() + lbl.slice(1)
        if (!porMes[label]) porMes[label] = { entradas: 0, saidas: 0 }
        if (l.tipo === 'receita' && l.status === 'recebido') porMes[label].entradas += l.valor
        if (l.tipo === 'despesa' && l.status === 'pago') porMes[label].saidas += l.valor
      }
      let saldo = 0
      return Object.entries(porMes).map(([dia, vals]) => {
        saldo += vals.entradas - vals.saidas
        return { dia, ...vals, saldo }
      })
    }
    const doMesOrdenado = [...doMes].sort((a, b) => a.data.localeCompare(b.data))
    const porDia: Record<string, { entradas: number; saidas: number }> = {}
    for (const l of doMesOrdenado) {
      const dia = l.data.slice(8, 10) + '/' + l.data.slice(5, 7)
      if (!porDia[dia]) porDia[dia] = { entradas: 0, saidas: 0 }
      if (l.tipo === 'receita' && l.status === 'recebido') porDia[dia].entradas += l.valor
      if (l.tipo === 'despesa' && l.status === 'pago') porDia[dia].saidas += l.valor
    }
    let saldo = 0
    return Object.entries(porDia).map(([dia, vals]) => {
      saldo += vals.entradas - vals.saidas
      return { dia, ...vals, saldo }
    })
  })()

  const kpis = [
    {
      label: allTime ? 'Faturamento Total' : 'Faturamento do Mês',
      valor: totalReceitas,
      sub: allTime ? 'Total de receitas recebidas' : `Receitas recebidas em ${format(mesSel, 'MMMM', { locale: ptBR })}`,
      icon: DollarSign, cor: 'text-brand-lima', bgIcon: 'bg-brand-lima/10',
    },
    { label: 'A Receber', valor: aReceber, sub: `${receitasMes.filter(l => l.status === 'pendente').length} pendentes`, icon: Clock, cor: 'text-yellow-400', bgIcon: 'bg-yellow-400/10' },
    {
      label: allTime ? 'Total Despesas' : 'Despesas do Mês',
      valor: totalDespesas + aPagar,
      sub: (() => {
        const pagas = despesasMes.filter(l => l.status === 'pago').length
        const pendentes = despesasMes.filter(l => l.status === 'pendente').length
        const parts = []
        if (pagas > 0) parts.push(`${pagas} paga${pagas !== 1 ? 's' : ''}`)
        if (pendentes > 0) parts.push(`${pendentes} pendente${pendentes !== 1 ? 's' : ''}`)
        return parts.length > 0 ? parts.join(' · ') : 'Sem despesas'
      })(),
      icon: TrendingDown, cor: 'text-brand-rosa', bgIcon: 'bg-brand-rosa/10',
    },
    { label: allTime ? 'Resultado Total' : 'Resultado do Mês', valor: totalReceitas - totalDespesas, sub: 'Receitas recebidas − Despesas pagas', icon: TrendingUp, cor: 'text-brand-violeta', bgIcon: 'bg-brand-violeta/10' },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Controle financeiro da agência" />
      <main className="flex-1 p-6">
        <PageHeader title="Financeiro" description={loading ? 'Carregando...' : mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}>
          <LancamentoForm onSuccess={load} />
        </PageHeader>

        <FinanceiroSubNav pathname={pathname} />

        {/* Seletor de mês */}
        <div className="flex items-center gap-3 mb-4">
          {!allTime && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <button
                onClick={() => setMesSel(d => subMonths(d, 1))}
                className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="relative">
                <button
                  onClick={() => { setPickerYear(mesSel.getFullYear()); setShowPicker(v => !v) }}
                  className="flex items-center gap-1 text-sm font-medium text-brand-lavanda min-w-[130px] justify-center capitalize hover:text-brand-lavanda/80 transition-colors"
                >
                  {mesLabel}
                  <ChevronDown className="h-3 w-3 text-brand-lavanda/40 shrink-0" />
                </button>
                {showPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 rounded-xl border border-white/[0.1] bg-[#1A0533] shadow-2xl p-3 w-56">
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={() => setPickerYear(y => y - 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-semibold text-brand-lavanda">{pickerYear}</span>
                        <button onClick={() => setPickerYear(y => y + 1)} disabled={pickerYear >= new Date().getFullYear()} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {Array.from({ length: 12 }, (_, i) => {
                          const d = new Date(pickerYear, i, 1)
                          const isSelected = format(d, 'yyyy-MM') === format(mesSel, 'yyyy-MM')
                          const isFuture = d > new Date()
                          const lbl = format(d, 'MMM', { locale: ptBR })
                          return (
                            <button
                              key={i}
                              disabled={isFuture}
                              onClick={() => { setMesSel(startOfMonth(d)); setAllTime(false); setShowPicker(false) }}
                              className={cn('py-1.5 rounded-lg text-xs transition-colors capitalize', isSelected ? 'bg-brand-lima text-brand-noite font-semibold' : 'text-brand-lavanda/60 hover:bg-white/[0.06] hover:text-brand-lavanda', isFuture && 'opacity-25 cursor-not-allowed')}
                            >
                              {lbl.charAt(0).toUpperCase() + lbl.slice(1, 3)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setMesSel(d => addMonths(d, 1))}
                disabled={isCurrentMes}
                className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {allTime && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-lima/30 bg-brand-lima/[0.04] px-4 py-2">
              <span className="text-sm font-medium text-brand-lima">Desde o início</span>
            </div>
          )}
          <button
            onClick={() => setAllTime(v => !v)}
            className={cn('text-xs px-3 py-1.5 rounded-lg border transition-colors', allTime ? 'border-brand-lima/30 text-brand-lima bg-brand-lima/[0.08] hover:bg-brand-lima/[0.12]' : 'border-white/[0.08] text-brand-lavanda/40 hover:text-brand-lavanda/70 hover:border-white/[0.14]')}
          >
            {allTime ? 'Ver por mês' : 'Desde o início'}
          </button>
          {!allTime && !isCurrentMes && (
            <button
              onClick={() => setMesSel(startOfMonth(new Date()))}
              className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 transition-colors"
            >
              Mês atual
            </button>
          )}
        </div>

        {/* Saldo em Conta */}
        <div className="rounded-2xl border border-brand-lima/25 bg-gradient-to-r from-brand-lima/[0.07] to-transparent p-5 flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-brand-lavanda/50 mb-1 uppercase tracking-wide">Saldo em Conta</p>
            <p className={cn('text-3xl font-bold', saldoAtual >= 0 ? 'text-brand-lima' : 'text-brand-rosa')} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {loading ? '...' : formatCurrency(saldoAtual)}
            </p>
            <p className="text-xs text-brand-lavanda/30 mt-1">Total recebido − Total pago · histórico completo</p>
          </div>
          <Wallet className="h-8 w-8 text-brand-lima/25 shrink-0" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', kpi.bgIcon)}>
                    <kpi.icon className={cn('h-5 w-5', kpi.cor)} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-brand-lavanda mb-1" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {formatCurrency(kpi.valor)}
                </p>
                <p className="text-xs text-brand-lavanda/50">{kpi.label}</p>
                <p className="text-xs text-brand-lavanda/30 mt-0.5">{kpi.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Fluxo de Caixa — {allTime ? 'Desde o início' : mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}
                </CardTitle>
                <span className="text-xs text-brand-lavanda/50">{allTime ? 'Saldo total:' : 'Saldo do mês:'} {formatCurrency(totalReceitas - totalDespesas)}</span>
              </div>
            </CardHeader>
            <CardContent>
              {cashflowData.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-brand-lavanda/30 text-sm">Sem movimentações no mês</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={cashflowData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.15)" />
                    <XAxis dataKey="dia" tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="saldo" stroke="#7C3AED" strokeWidth={2} fill="url(#gradSaldo)" name="saldo" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{allTime ? 'Resumo Geral' : 'Resumo do Mês'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-brand-lavanda/60">Total Receitas</span>
                  <span className="text-brand-lima font-semibold">{formatCurrency(totalReceitas)}</span>
                </div>
                <div className="h-2 rounded-full bg-brand-noite overflow-hidden">
                  <div className="h-full rounded-full bg-brand-lima transition-all" style={{ width: totalReceitas + totalDespesas > 0 ? `${(totalReceitas / (totalReceitas + totalDespesas)) * 100}%` : '0%' }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-brand-lavanda/60">Total Despesas</span>
                  <span className="text-brand-rosa font-semibold">{formatCurrency(totalDespesas)}</span>
                </div>
                <div className="h-2 rounded-full bg-brand-noite overflow-hidden">
                  <div className="h-full rounded-full bg-brand-rosa transition-all" style={{ width: totalReceitas + totalDespesas > 0 ? `${(totalDespesas / (totalReceitas + totalDespesas)) * 100}%` : '0%' }} />
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-brand-lavanda/60">Resultado</span>
                  <span className={cn('font-bold', totalReceitas - totalDespesas >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>
                    {formatCurrency(totalReceitas - totalDespesas)}
                  </span>
                </div>
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-brand-lavanda/40">A Receber</span>
                  <span className="text-yellow-400">{formatCurrency(aReceber)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-brand-lavanda/40">A Pagar</span>
                  <span className="text-brand-rosa/70">{formatCurrency(aPagar)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Receitas e Despesas lado a lado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Receitas */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand-lima" />
                  <CardTitle className="text-base">Receitas</CardTitle>
                  <span className="text-xs text-brand-lavanda/40 capitalize font-normal">{mesLabel}</span>
                </div>
                <Link href="/financeiro/receitas" className="text-xs text-brand-violeta hover:text-brand-lima transition-colors">Ver todas →</Link>
              </div>
              {!loading && (
                <div className="flex items-center gap-4 pt-1">
                  <span className="text-xs text-brand-lavanda/50">Recebido: <span className="text-brand-lima font-semibold">{formatCurrency(receitasMes.filter(l => l.status === 'recebido').reduce((s, l) => s + l.valor, 0))}</span></span>
                  {receitasMes.filter(l => l.status === 'pendente').length > 0 && (
                    <span className="text-xs text-brand-lavanda/50">Pendente: <span className="text-yellow-400 font-semibold">{formatCurrency(receitasMes.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor, 0))}</span></span>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/[0.04]">
                {loading ? (
                  <p className="text-center text-brand-lavanda/40 text-sm py-8">Carregando...</p>
                ) : receitasMes.length === 0 ? (
                  <p className="text-center text-brand-lavanda/40 text-sm py-8">Nenhuma receita neste período.</p>
                ) : [...receitasMes].sort((a, b) => b.data.localeCompare(a.data)).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-brand-lavanda font-medium truncate">{r.descricao}</p>
                      <p className="text-xs text-brand-lavanda/40 mt-0.5">
                        {r.categorias_financeiras?.nome ?? '—'}{r.clientes?.nome ? ` · ${r.clientes.nome}` : ''} · {formatDate(r.data)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-brand-lima shrink-0">+{formatCurrency(r.valor)}</span>
                    <Badge variant={r.status === 'recebido' ? 'concluido' : r.status === 'pendente' ? 'pendente' : 'inativo'} className="shrink-0">
                      {r.status === 'recebido' ? 'Recebido' : r.status === 'pendente' ? 'Pendente' : 'Cancelado'}
                    </Badge>
                    <div className="shrink-0 w-14 flex justify-end">
                      {deletingId === r.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => deleteLancamento(r.id)} className="text-[11px] text-brand-rosa font-medium">Excluir</button>
                          <span className="text-brand-lavanda/20">·</span>
                          <button onClick={() => setDeletingId(null)} className="text-[11px] text-brand-lavanda/40">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingId(r.id)} className="flex h-6 w-6 items-center justify-center rounded text-brand-lavanda/0 group-hover:text-brand-lavanda/25 hover:!text-brand-rosa hover:bg-brand-rosa/10 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {receitasMes.length > 0 && (
                <div className="border-t border-white/[0.06] px-4 py-2.5 flex justify-between text-xs text-brand-lavanda/40">
                  <span>{receitasMes.length} lançamento{receitasMes.length !== 1 ? 's' : ''}</span>
                  <span className="font-bold text-brand-lima">{formatCurrency(receitasMes.reduce((s, r) => s + r.valor, 0))}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Despesas */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-brand-rosa" />
                  <CardTitle className="text-base">Despesas</CardTitle>
                  <span className="text-xs text-brand-lavanda/40 capitalize font-normal">{mesLabel}</span>
                </div>
                <Link href="/financeiro/despesas" className="text-xs text-brand-violeta hover:text-brand-lima transition-colors">Ver todas →</Link>
              </div>
              {!loading && (
                <div className="flex items-center gap-4 pt-1">
                  <span className="text-xs text-brand-lavanda/50">Pago: <span className="text-brand-rosa font-semibold">{formatCurrency(despesasMes.filter(l => l.status === 'pago').reduce((s, l) => s + l.valor, 0))}</span></span>
                  {despesasMes.filter(l => l.status === 'pendente').length > 0 && (
                    <span className="text-xs text-brand-lavanda/50">Pendente: <span className="text-yellow-400 font-semibold">{formatCurrency(despesasMes.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor, 0))}</span></span>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/[0.04]">
                {loading ? (
                  <p className="text-center text-brand-lavanda/40 text-sm py-8">Carregando...</p>
                ) : despesasMes.length === 0 ? (
                  <p className="text-center text-brand-lavanda/40 text-sm py-8">Nenhuma despesa neste período.</p>
                ) : [...despesasMes].sort((a, b) => b.data.localeCompare(a.data)).map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-brand-lavanda font-medium truncate">{d.descricao}</p>
                      <p className="text-xs text-brand-lavanda/40 mt-0.5">
                        {d.categorias_financeiras?.nome ?? '—'} · {formatDate(d.data)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-brand-rosa shrink-0">-{formatCurrency(d.valor)}</span>
                    <Badge variant={d.status === 'pago' ? 'concluido' : d.status === 'pendente' ? 'pendente' : 'inativo'} className="shrink-0">
                      {d.status === 'pago' ? 'Pago' : d.status === 'pendente' ? 'Pendente' : 'Cancelado'}
                    </Badge>
                    <div className="shrink-0 w-14 flex justify-end">
                      {deletingId === d.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => deleteLancamento(d.id)} className="text-[11px] text-brand-rosa font-medium">Excluir</button>
                          <span className="text-brand-lavanda/20">·</span>
                          <button onClick={() => setDeletingId(null)} className="text-[11px] text-brand-lavanda/40">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingId(d.id)} className="flex h-6 w-6 items-center justify-center rounded text-brand-lavanda/0 group-hover:text-brand-lavanda/25 hover:!text-brand-rosa hover:bg-brand-rosa/10 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {despesasMes.length > 0 && (
                <div className="border-t border-white/[0.06] px-4 py-2.5 flex justify-between text-xs text-brand-lavanda/40">
                  <span>{despesasMes.length} despesa{despesasMes.length !== 1 ? 's' : ''}</span>
                  <span className="font-bold text-brand-rosa">{formatCurrency(despesasMes.reduce((s, d) => s + d.valor, 0))}</span>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  )
}

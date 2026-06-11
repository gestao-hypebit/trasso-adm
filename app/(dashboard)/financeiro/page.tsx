'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, TrendingDown, Clock, DollarSign, ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
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
  categorias_financeiras: { nome: string } | null
  clientes: { nome: string } | null
}

type ProdutoMrr = { id: string; nome: string; cor: string; mrr: number }
type SaasAll = { id: string; nome: string; mrr: number; ultimo_pagamento: string | null; proximo_vencimento: string | null; produto_id: string }

type DiaFluxo = { dia: string; entradas: number; saidas: number; saldo: number }

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
  const [produtosMrr, setProdutosMrr] = useState<ProdutoMrr[]>([])
  const [saasAll, setSaasAll] = useState<SaasAll[]>([])
  const [loading, setLoading] = useState(true)

  const [mesSel, setMesSel] = useState(() => startOfMonth(new Date()))
  const [allTime, setAllTime] = useState(false)
  const mesStart = allTime ? '0000-01-01' : format(mesSel, 'yyyy-MM-01')
  const mesEnd = allTime ? '9999-12-31' : format(endOfMonth(mesSel), 'yyyy-MM-dd')
  const mesLabel = allTime ? 'Desde o início' : format(mesSel, 'MMMM yyyy', { locale: ptBR })
  const isCurrentMes = !allTime && format(mesSel, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  useEffect(() => {
    const supabase = createClient()
    const db = supabase as any
    async function load() {
      const { data } = await supabase
        .from('lancamentos')
        .select('id, tipo, descricao, valor, data, status, categorias_financeiras(nome), clientes(nome)')
        .order('data', { ascending: false })
      setLancamentos((data as Lancamento[]) ?? [])

      const { data: prods } = await db.from('produtos').select('id, nome, cor').eq('ativo', true)
      if (prods?.length) {
        const [mrrList, saasResult] = await Promise.all([
          Promise.all(prods.map(async (p: any) => {
            const { data: clientes } = await db
              .from('saas_clientes').select('mrr').eq('produto_id', p.id).in('status', ['ativo', 'trial'])
            return {
              id: p.id, nome: p.nome, cor: p.cor,
              mrr: Math.round((clientes ?? []).reduce((s: number, c: any) => s + (c.mrr ?? 0), 0) * 100) / 100,
            }
          })),
          db.from('saas_clientes')
            .select('id, nome, mrr, ultimo_pagamento, proximo_vencimento, produto_id')
            .in('status', ['ativo', 'trial']) as Promise<{ data: SaasAll[] | null }>,
        ])
        setProdutosMrr(mrrList)
        setSaasAll(saasResult.data ?? [])
      }

      setLoading(false)
    }
    load()
  }, [])

  const doMes = lancamentos.filter(l => l.data >= mesStart && l.data <= mesEnd)
  const receitasMes = doMes.filter(l => l.tipo === 'receita')
  const despesasMes = doMes.filter(l => l.tipo === 'despesa')
  const receitasAgencia = receitasMes.filter(l => l.status === 'recebido').reduce((s, l) => s + l.valor, 0)
  const mrrSaas = produtosMrr.reduce((s, p) => s + p.mrr, 0)
  const saasFaturadoMes = saasAll
    .filter(s => s.ultimo_pagamento && s.ultimo_pagamento >= mesStart && s.ultimo_pagamento <= mesEnd)
    .reduce((sum, s) => sum + s.mrr, 0)
  const totalReceitas = receitasAgencia + saasFaturadoMes
  const totalDespesas = despesasMes.filter(l => l.status === 'pago').reduce((s, l) => s + l.valor, 0)
  const aReceberLanc = receitasMes.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor, 0)
  const saasVencMes = saasAll.filter(s => s.proximo_vencimento && s.proximo_vencimento >= mesStart && s.proximo_vencimento <= mesEnd)
  const saasAReceber = saasVencMes.reduce((s, c) => s + c.mrr, 0)
  const aReceber = aReceberLanc + saasAReceber
  const aPagar = despesasMes.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor, 0)

  const saldoAtual = lancamentos.reduce((s, l) => {
    if (l.tipo === 'receita' && l.status === 'recebido') return s + l.valor
    if (l.tipo === 'despesa' && l.status === 'pago') return s - l.valor
    return s
  }, 0) + saasAll.filter(s => s.ultimo_pagamento).reduce((sum, s) => sum + s.mrr, 0)

  const recentes = [...lancamentos]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 8)

  // SaaS: agrupamento por mês baseado em ultimo_pagamento
  const saasPorMes = (() => {
    const mapa: Record<string, { mrr: number; clientes: number }> = {}
    for (const s of saasAll) {
      if (!s.ultimo_pagamento) continue
      const k = s.ultimo_pagamento.slice(0, 7)
      if (!mapa[k]) mapa[k] = { mrr: 0, clientes: 0 }
      mapa[k].mrr += s.mrr
      mapa[k].clientes++
    }
    return Object.entries(mapa)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([k, v]) => ({
        mesKey: k,
        label: format(new Date(k + '-01T12:00:00Z'), 'MMM/yy', { locale: ptBR }),
        mrr: Math.round(v.mrr * 100) / 100,
        clientes: v.clientes,
      }))
  })()

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
      sub: saasFaturadoMes > 0
        ? `Agência + SaaS recebido (${formatCurrency(saasFaturadoMes)})`
        : allTime ? 'Total de receitas recebidas' : `Receitas recebidas em ${format(mesSel, 'MMMM', { locale: ptBR })}`,
      icon: DollarSign, cor: 'text-brand-lima', bgIcon: 'bg-brand-lima/10',
    },
    { label: 'A Receber', valor: aReceber, sub: saasAReceber > 0 ? `${receitasMes.filter(l => l.status === 'pendente').length} lançamentos + ${saasVencMes.length} SaaS` : `${receitasMes.filter(l => l.status === 'pendente').length} pendentes`, icon: Clock, cor: 'text-yellow-400', bgIcon: 'bg-yellow-400/10' },
    { label: 'A Pagar', valor: aPagar, sub: `${despesasMes.filter(l => l.status === 'pendente').length} pendentes`, icon: TrendingDown, cor: 'text-brand-rosa', bgIcon: 'bg-brand-rosa/10' },
    { label: 'Resultado do Mês', valor: totalReceitas - totalDespesas, sub: 'Receitas − Despesas', icon: TrendingUp, cor: 'text-brand-violeta', bgIcon: 'bg-brand-violeta/10' },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Controle financeiro da agência" />
      <main className="flex-1 p-6">
        <PageHeader title="Financeiro" description={loading ? 'Carregando...' : mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}>
          <LancamentoForm />
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
              <span className="text-sm font-medium text-brand-lavanda min-w-[130px] text-center capitalize">
                {mesLabel}
              </span>
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

        {/* SaaS: visão geral por mês */}
        {saasPorMes.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Receita SaaS por Mês</CardTitle>
                <span className="text-xs text-brand-lavanda/40">
                  MRR atual: <span className="text-brand-lima font-semibold">{formatCurrency(mrrSaas)}</span>
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-6 py-2.5 text-xs font-medium text-brand-lavanda/40">Mês</th>
                    <th className="text-right px-6 py-2.5 text-xs font-medium text-brand-lavanda/40">Clientes pagantes</th>
                    <th className="text-right px-6 py-2.5 text-xs font-medium text-brand-lavanda/40">Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {saasPorMes.map(({ mesKey, label, mrr, clientes }) => {
                    const isCurrent = mesKey === format(mesSel, 'yyyy-MM')
                    return (
                      <tr key={mesKey} className={cn('hover:bg-white/[0.02] transition-colors', isCurrent && 'bg-brand-lima/[0.03]')}>
                        <td className="px-6 py-3">
                          <span className={cn('text-sm font-medium', isCurrent ? 'text-brand-lima' : 'text-brand-lavanda')}>
                            {label.charAt(0).toUpperCase() + label.slice(1)}
                          </span>
                          {isCurrent && <span className="ml-2 text-[10px] bg-brand-lima/20 text-brand-lima px-1.5 py-0.5 rounded-full">atual</span>}
                        </td>
                        <td className="px-6 py-3 text-right text-xs text-brand-lavanda/60">{clientes} cliente{clientes !== 1 ? 's' : ''}</td>
                        <td className="px-6 py-3 text-right font-semibold text-brand-lima">{formatCurrency(mrr)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

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
                <div className="space-y-1 pl-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-brand-lavanda/40">Agência</span>
                    <span className="text-brand-lavanda/60">{formatCurrency(receitasAgencia)}</span>
                  </div>
                  {saasFaturadoMes > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-brand-lavanda/40">SaaS recebido</span>
                      <span className="text-brand-lavanda/60">{formatCurrency(saasFaturadoMes)}</span>
                    </div>
                  )}
                  {mrrSaas > 0 && (
                    <div className="flex justify-between text-[11px] opacity-60">
                      <span className="text-brand-lavanda/40">MRR total (ref.)</span>
                      <span className="text-brand-lavanda/40">{formatCurrency(mrrSaas)}</span>
                    </div>
                  )}
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
                {saasVencMes.length > 0 && (
                  <div className="pl-3 space-y-1 mt-1">
                    {saasVencMes.map((sv: SaasAll) => {
                      const prod = produtosMrr.find(p => p.id === sv.produto_id)
                      return (
                        <div key={sv.id} className="flex justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-brand-lavanda/40 truncate max-w-[55%]">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: prod?.cor ?? '#7C3AED' }} />
                            {sv.nome}
                          </span>
                          <span className="text-yellow-400/70">{formatDate(sv.proximo_vencimento)} · {formatCurrency(sv.mrr)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-brand-lavanda/40">A Pagar</span>
                  <span className="text-brand-rosa/70">{formatCurrency(aPagar)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lançamentos Recentes</CardTitle>
              <Link href="/financeiro/receitas" className="text-xs text-brand-violeta hover:text-brand-lima transition-colors">
                Ver todos →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-center text-brand-lavanda/40 text-sm py-8">Carregando...</p>
            ) : recentes.length === 0 ? (
              <p className="text-center text-brand-lavanda/40 text-sm py-8">Nenhum lançamento encontrado.</p>
            ) : (
              <div className="divide-y divide-brand-violeta/10">
                {recentes.map((l) => (
                  <div key={l.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', l.tipo === 'receita' ? 'bg-brand-lima/10' : 'bg-brand-rosa/10')}>
                      {l.tipo === 'receita'
                        ? <TrendingUp className="h-4 w-4 text-brand-lima" />
                        : <TrendingDown className="h-4 w-4 text-brand-rosa" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-brand-lavanda truncate">{l.descricao}</p>
                      <p className="text-xs text-brand-lavanda/40">
                        {l.categorias_financeiras?.nome ?? '—'}{l.clientes?.nome ? ` • ${l.clientes.nome}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-semibold', l.tipo === 'receita' ? 'text-brand-lima' : 'text-brand-rosa')}>
                        {l.tipo === 'receita' ? '+' : '-'}{formatCurrency(l.valor)}
                      </p>
                      <p className="text-xs text-brand-lavanda/40">{formatDate(l.data)}</p>
                    </div>
                    <Badge
                      variant={l.status === 'recebido' || l.status === 'pago' ? 'concluido' : l.status === 'pendente' ? 'pendente' : 'inativo'}
                      className="shrink-0"
                    >
                      {l.status === 'recebido' ? 'Recebido' : l.status === 'pago' ? 'Pago' : l.status === 'pendente' ? 'Pendente' : 'Cancelado'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

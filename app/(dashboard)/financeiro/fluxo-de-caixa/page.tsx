'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Download, TrendingUp, TrendingDown, Landmark, LineChart, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LancamentoForm } from '@/components/financeiro/lancamento-form'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { formatCurrency, cn, addMonthsISO } from '@/lib/utils'
import { hojeISO, baixarCSV } from '@/lib/financeiro'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useFrente, filtrarLancamentos } from '@/components/layout/frente'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Lanc = { tipo: string; valor: number; data: string; status: string }

type MesFluxo = {
  mesKey: string; mes: string
  fase: 'realizado' | 'atual' | 'projetado'
  entradas: number; saidas: number           // realizadas
  entradasPrev: number; saidasPrev: number   // pendentes com vencimento no mês
  resultado: number; saldo: number
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const m: MesFluxo = payload[0].payload
  const linha = (rotulo: string, v: number, cls: string) => v ? <p className={cls}>{rotulo}: {formatCurrency(v)}</p> : null
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl space-y-0.5">
      <p className="text-brand-lavanda/60 mb-1">{label} · {m.fase === 'realizado' ? 'realizado' : m.fase === 'atual' ? 'mês atual' : 'projetado'}</p>
      {linha('Entradas', m.entradas, 'text-brand-lima')}
      {linha('Entradas previstas', m.entradasPrev, 'text-brand-lima/60')}
      {linha('Saídas', m.saidas, 'text-brand-rosa')}
      {linha('Saídas previstas', m.saidasPrev, 'text-brand-rosa/60')}
      <p className="font-bold text-brand-lavanda pt-1">Saldo: {formatCurrency(m.saldo)}</p>
    </div>
  )
}

export default function FluxoCaixaPage() {
  const pathname = usePathname()
  const [lancs, setLancs] = useState<Lanc[]>([])
  const [loading, setLoading] = useState(true)
  const [mesesPassados, setMesesPassados] = useState(6)
  const [mesesFuturos, setMesesFuturos] = useState(6)

  const { frente, pronto } = useFrente()

  const load = useCallback(async () => {
    if (!pronto) return
    const { data } = await filtrarLancamentos(
      (createClient() as any).from('lancamentos').select('tipo, valor, data, status').neq('status', 'cancelado'),
      frente,
    )
    setLancs((data as Lanc[]) ?? [])
    setLoading(false)
  }, [frente, pronto])

  useEffect(() => { load() }, [load])

  const hoje = hojeISO()
  const mesAtual = hoje.slice(0, 7)

  const calc = useMemo(() => {
    const liquidado = (l: Lanc) => l.status === 'recebido' || l.status === 'pago'
    const inicioJanela = addMonthsISO(mesAtual + '-01', -mesesPassados).slice(0, 7)
    const chaves = Array.from({ length: mesesPassados + 1 + mesesFuturos }, (_, i) => addMonthsISO(inicioJanela + '-01', i).slice(0, 7))

    // Tudo que foi realizado antes da janela vira saldo de abertura.
    const saldoInicial = lancs
      .filter(l => liquidado(l) && l.data.slice(0, 7) < inicioJanela)
      .reduce((s, l) => s + (l.tipo === 'receita' ? l.valor : -l.valor), 0)

    // Pendências já vencidas não entram na projeção: são incertas e aparecem à parte.
    const vencidos = lancs.filter(l => l.status === 'pendente' && l.data < hoje)
    const receberAtrasado = vencidos.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
    const pagarAtrasado = vencidos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)

    let saldo = saldoInicial
    const meses: MesFluxo[] = chaves.map((mesKey) => {
      const doMes = lancs.filter(l => l.data.startsWith(mesKey))
      const somar = (f: (l: Lanc) => boolean) => doMes.filter(f).reduce((s, l) => s + l.valor, 0)
      const entradas = somar(l => l.tipo === 'receita' && liquidado(l))
      const saidas = somar(l => l.tipo === 'despesa' && liquidado(l))
      const fase = mesKey < mesAtual ? 'realizado' : mesKey === mesAtual ? 'atual' : 'projetado'
      const entradasPrev = fase === 'realizado' ? 0 : somar(l => l.tipo === 'receita' && l.status === 'pendente' && l.data >= hoje)
      const saidasPrev = fase === 'realizado' ? 0 : somar(l => l.tipo === 'despesa' && l.status === 'pendente' && l.data >= hoje)
      const resultado = entradas + entradasPrev - saidas - saidasPrev
      saldo += resultado
      const lbl = format(parseISO(`${mesKey}-01`), 'MMM/yy', { locale: ptBR })
      return { mesKey, mes: lbl.charAt(0).toUpperCase() + lbl.slice(1), fase, entradas, saidas, entradasPrev, saidasPrev, resultado, saldo }
    })

    const saldoHoje = lancs
      .filter(liquidado)
      .reduce((s, l) => s + (l.tipo === 'receita' ? l.valor : -l.valor), 0)
    const futuros = meses.filter(m => m.fase !== 'realizado')
    const minimo = futuros.reduce((min, m) => m.saldo < min.saldo ? m : min, futuros[0])

    return { meses, saldoInicial, saldoHoje, receberAtrasado, pagarAtrasado, saldoFinal: meses.at(-1)?.saldo ?? 0, minimo }
  }, [lancs, mesesPassados, mesesFuturos, hoje, mesAtual])

  const chartData = calc.meses.map(m => ({
    ...m,
    barEntradas: m.entradas + m.entradasPrev,
    barSaidas: -(m.saidas + m.saidasPrev),
  }))

  function exportar() {
    baixarCSV(
      `fluxo-de-caixa-${hoje}.csv`,
      ['Mês', 'Fase', 'Entradas realizadas', 'Entradas previstas', 'Saídas realizadas', 'Saídas previstas', 'Resultado', 'Saldo'],
      calc.meses.map(m => [m.mes, m.fase, m.entradas, m.entradasPrev, m.saidas, m.saidasPrev, m.resultado, m.saldo]),
    )
  }

  const kpis = [
    { label: 'Saldo em caixa hoje', valor: calc.saldoHoje, sub: 'Tudo recebido − tudo pago', icon: Landmark, cor: 'text-brand-lavanda', bg: 'bg-brand-violeta/10' },
    { label: `Saldo projetado (${calc.meses.at(-1)?.mes ?? ''})`, valor: calc.saldoFinal, sub: 'Considerando vencimentos em dia', icon: LineChart, cor: calc.saldoFinal >= 0 ? 'text-brand-lima' : 'text-brand-rosa', bg: 'bg-brand-lima/10' },
    { label: 'Menor saldo previsto', valor: calc.minimo?.saldo ?? 0, sub: calc.minimo ? `em ${calc.minimo.mes}` : '—', icon: TrendingDown, cor: (calc.minimo?.saldo ?? 0) >= 0 ? 'text-brand-lavanda' : 'text-brand-rosa', bg: 'bg-brand-rosa/10' },
    { label: 'Recebíveis em atraso', valor: calc.receberAtrasado, sub: `Fora da projeção · a pagar atrasado ${formatCurrency(calc.pagarAtrasado)}`, icon: AlertTriangle, cor: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  ]

  const fmtK = (v: number) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Fluxo de caixa" />
      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="Fluxo de Caixa" description="Realizado até hoje e projeção pelos vencimentos em aberto">
          <Button variant="outline" size="sm" onClick={exportar} disabled={loading}><Download className="h-4 w-4" /> Exportar CSV</Button>
          <LancamentoForm onSuccess={load} />
        </PageHeader>

        <FinanceiroSubNav pathname={pathname} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', k.bg)}>
                  <k.icon className={cn('h-5 w-5', k.cor)} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-brand-lavanda/50">{k.label}</p>
                  <p className={cn('text-xl font-bold', k.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {loading ? '...' : formatCurrency(k.valor)}
                  </p>
                  <p className="text-[11px] text-brand-lavanda/40 truncate">{k.sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Entradas, saídas e saldo</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={String(mesesPassados)} onValueChange={(v) => setMesesPassados(Number(v))}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 6, 12, 24].map(n => <SelectItem key={n} value={String(n)}>{n} meses atrás</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(mesesFuturos)} onValueChange={(v) => setMesesFuturos(Number(v))}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 6, 12].map(n => <SelectItem key={n} value={String(n)}>{n} meses à frente</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-lavanda/50 pt-1">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand-lima" /> Entradas</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand-rosa" /> Saídas</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[#A78BFA]" /> Saldo</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand-lima/40" /> Projetado</span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[260px] flex items-center justify-center text-brand-lavanda/30 text-sm">Carregando...</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.15)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <ReferenceLine y={0} stroke="rgba(245,242,255,0.2)" />
                  <Bar dataKey="barEntradas" stackId="f" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {chartData.map((m, i) => <Cell key={i} fill="#B8F000" fillOpacity={m.fase === 'projetado' ? 0.4 : 1} />)}
                  </Bar>
                  <Bar dataKey="barSaidas" stackId="f" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {chartData.map((m, i) => <Cell key={i} fill="#FF4D8D" fillOpacity={m.fase === 'projetado' ? 0.4 : 1} />)}
                  </Bar>
                  <Line dataKey="saldo" type="monotone" stroke="#A78BFA" strokeWidth={2} dot={{ r: 2.5, fill: '#A78BFA' }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Demonstrativo mensal</CardTitle>
            <p className="text-xs text-brand-lavanda/40">Saldo de abertura do período: {formatCurrency(calc.saldoInicial)}</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Mês</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Entradas</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Saídas</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Resultado</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Saldo final (com previstos)</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.meses.map((m) => {
                    return (
                      <tr key={m.mesKey} className={cn('border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors', m.fase === 'atual' && 'bg-white/[0.02]')}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-brand-lavanda">{m.mes}</span>
                            {m.fase === 'atual' && <Badge variant="lead">Mês atual</Badge>}
                            {m.fase === 'projetado' && <Badge variant="outline">Projetado</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {/* Só o que já foi recebido; o previsto fica na linha de baixo. */}
                          <span className={cn('font-medium', m.fase === 'projetado' ? 'text-brand-lima/60' : 'text-brand-lima')}>+{formatCurrency(m.entradas)}</span>
                          {m.entradasPrev > 0 && (
                            <p className="text-[10px] text-brand-lavanda/40">{formatCurrency(m.entradasPrev)} a receber</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={cn('font-medium', m.fase === 'projetado' ? 'text-brand-rosa/60' : 'text-brand-rosa')}>-{formatCurrency(m.saidas)}</span>
                          {m.saidasPrev > 0 && (
                            <p className="text-[10px] text-brand-lavanda/40">{formatCurrency(m.saidasPrev)} a pagar</p>
                          )}
                        </td>
                        {(() => {
                          // Resultado realizado (recebido − pago); o previsto fica embaixo.
                          const realizado = m.entradas - m.saidas
                          const previsto = m.entradasPrev - m.saidasPrev
                          return (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className={cn('font-semibold', realizado >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>
                                {realizado >= 0 ? '+' : ''}{formatCurrency(realizado)}
                              </span>
                              {(m.entradasPrev > 0 || m.saidasPrev > 0) && (
                                <p className="text-[10px] text-brand-lavanda/40">{previsto >= 0 ? '+' : ''}{formatCurrency(previsto)} previsto</p>
                              )}
                            </td>
                          )
                        })()}
                        <td className={cn('px-4 py-3 text-right font-bold whitespace-nowrap', m.saldo >= 0 ? 'text-brand-lavanda' : 'text-brand-rosa')}>
                          {formatCurrency(m.saldo)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-brand-lavanda/30 mt-3 flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3" />
          Meses passados usam apenas o que foi recebido/pago. Mês atual e futuros somam os títulos em aberto pela data de vencimento; títulos já vencidos ficam fora da projeção.
        </p>
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LancamentoForm } from '@/components/financeiro/lancamento-form'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type MesFluxo = {
  mes: string; mesKey: string
  entradas: number; saidas: number; resultado: number; saldo_final: number
  temSaas?: boolean
}

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
  const val = payload[0].value
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl">
      <p className="text-brand-lavanda/60 mb-1">{label}</p>
      <p className={cn('font-bold', val >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>
        Resultado: {formatCurrency(val)}
      </p>
    </div>
  )
}

export default function FluxoCaixaPage() {
  const pathname = usePathname()
  const [fluxoMensal, setFluxoMensal] = useState<MesFluxo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const db = supabase as any
    async function load() {
      const { data: rawData } = await supabase
        .from('lancamentos')
        .select('tipo, valor, data, status')
        .in('status', ['recebido', 'pago'])
        .order('data', { ascending: true })

      const data = rawData as { tipo: string; valor: number; data: string; status: string }[] | null

      const porMes: Record<string, { entradas: number; saidas: number }> = {}
      for (const l of data ?? []) {
        const mesKey = l.data.slice(0, 7)
        if (!porMes[mesKey]) porMes[mesKey] = { entradas: 0, saidas: 0 }
        if (l.tipo === 'receita') porMes[mesKey].entradas += l.valor
        if (l.tipo === 'despesa') porMes[mesKey].saidas += l.valor
      }

      // Adiciona MRR SaaS ao mês corrente
      const currentMonthKey = new Date().toISOString().slice(0, 7)
      const { data: prods } = await db.from('produtos').select('id').eq('ativo', true)
      let mrrSaas = 0
      if (prods?.length) {
        for (const p of prods) {
          const { data: clientes } = await db
            .from('saas_clientes').select('mrr').eq('produto_id', p.id).in('status', ['ativo', 'trial'])
          mrrSaas += (clientes ?? []).reduce((s: number, c: any) => s + (c.mrr ?? 0), 0)
        }
      }
      if (mrrSaas > 0) {
        if (!porMes[currentMonthKey]) porMes[currentMonthKey] = { entradas: 0, saidas: 0 }
        porMes[currentMonthKey].entradas += Math.round(mrrSaas * 100) / 100
      }

      let saldoAcumulado = 0
      const fluxo: MesFluxo[] = Object.entries(porMes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mesKey, vals]) => {
          const resultado = vals.entradas - vals.saidas
          saldoAcumulado += resultado
          const label = format(parseISO(`${mesKey}-01`), "MMM/yy", { locale: ptBR })
          return {
            mes: label.charAt(0).toUpperCase() + label.slice(1),
            mesKey,
            entradas: vals.entradas,
            saidas: vals.saidas,
            resultado,
            saldo_final: saldoAcumulado,
            temSaas: mesKey === currentMonthKey && mrrSaas > 0,
          }
        })

      setFluxoMensal(fluxo)
      setLoading(false)
    }
    load()
  }, [])

  const totalEntradas = fluxoMensal.reduce((s, m) => s + m.entradas, 0)
  const totalSaidas = fluxoMensal.reduce((s, m) => s + m.saidas, 0)
  const saldoFinal = fluxoMensal.at(-1)?.saldo_final ?? 0

  const barData = fluxoMensal.map((m) => ({ mes: m.mes, resultado: m.resultado }))

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Fluxo de caixa da agência" />
      <main className="flex-1 p-6">
        <PageHeader title="Financeiro" description="Fluxo de Caixa">
          <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Exportar CSV</Button>
          <LancamentoForm />
        </PageHeader>

        <FinanceiroSubNav pathname={pathname} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Entradas (realizado)', valor: totalEntradas, cor: 'text-brand-lima', icon: TrendingUp, bg: 'bg-brand-lima/10' },
            { label: 'Total Saídas (realizado)', valor: totalSaidas, cor: 'text-brand-rosa', icon: TrendingDown, bg: 'bg-brand-rosa/10' },
            { label: 'Saldo Acumulado', valor: saldoFinal, cor: 'text-brand-lavanda', icon: TrendingUp, bg: 'bg-brand-violeta/10' },
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

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Resultado Mensal (Entradas − Saídas)</CardTitle>
              <div className="flex items-center gap-4 text-xs text-brand-lavanda/50">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-lima" /> Positivo</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-rosa" /> Negativo</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-brand-lavanda/30 text-sm">
                {loading ? 'Carregando...' : 'Sem dados para exibir'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.15)" />
                  <XAxis dataKey="mes" tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(245,242,255,0.2)" />
                  <Bar dataKey="resultado" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.resultado >= 0 ? '#B8F000' : '#FF4D8D'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Demonstrativo Mensal</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Mês</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Entradas</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Saídas</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Resultado</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                  ) : fluxoMensal.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Nenhum lançamento realizado encontrado.</td></tr>
                  ) : fluxoMensal.map((m) => (
                    <tr key={m.mesKey} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-brand-lavanda">{m.mes}</span>
                          {m.temSaas && (
                            <span className="text-[10px] text-brand-violeta/70 border border-brand-violeta/30 rounded px-1 py-0.5">+ SaaS</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-brand-lima whitespace-nowrap">
                        +{formatCurrency(m.entradas)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-brand-rosa whitespace-nowrap">
                        -{formatCurrency(m.saidas)}
                      </td>
                      <td className={cn('px-4 py-3.5 text-right font-semibold whitespace-nowrap', m.resultado >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>
                        {m.resultado >= 0 ? '+' : ''}{formatCurrency(m.resultado)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-brand-lavanda whitespace-nowrap">
                        {formatCurrency(m.saldo_final)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {fluxoMensal.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-white/[0.1] bg-brand-violeta/5">
                      <td className="px-6 py-3 text-xs font-bold text-brand-lavanda/70">TOTAL REALIZADO</td>
                      <td className="px-4 py-3 text-right font-bold text-brand-lima whitespace-nowrap text-sm">
                        +{formatCurrency(totalEntradas)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-brand-rosa whitespace-nowrap text-sm">
                        -{formatCurrency(totalSaidas)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-brand-lavanda whitespace-nowrap text-sm">
                        {totalEntradas - totalSaidas >= 0 ? '+' : ''}{formatCurrency(totalEntradas - totalSaidas)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-brand-lavanda whitespace-nowrap text-sm">
                        {formatCurrency(saldoFinal)}
                      </td>
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

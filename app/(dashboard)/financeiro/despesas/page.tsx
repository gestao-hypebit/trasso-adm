'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, TrendingDown, CheckCircle2, Clock, Download } from 'lucide-react'
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
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { createClient } from '@/lib/supabase/client'

type Lancamento = {
  id: string; descricao: string; valor: number; data: string
  status: string; forma_pagamento: string | null
  categorias_financeiras: { nome: string } | null
}

const subNav = [
  { href: '/financeiro', label: 'Visão Geral' },
  { href: '/financeiro/receitas', label: 'Receitas' },
  { href: '/financeiro/despesas', label: 'Despesas' },
  { href: '/financeiro/fluxo-de-caixa', label: 'Fluxo de Caixa' },
]

const statusConfig = {
  pago: { label: 'Pago', variant: 'concluido' as const },
  pendente: { label: 'Pendente', variant: 'pendente' as const },
  cancelado: { label: 'Cancelado', variant: 'inativo' as const },
}

const CORES = ['#7C3AED', '#FF4D8D', '#B8F000', '#F59E0B', '#06B6D4', '#5B21B6', '#10B981']

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

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, data, status, forma_pagamento, categorias_financeiras(nome)')
        .eq('tipo', 'despesa')
        .order('data', { ascending: false })
      setDespesas((data as Lancamento[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtradas = despesas.filter((d) => {
    const matchBusca = d.descricao.toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || d.status === filtroStatus
    return matchBusca && matchStatus
  })

  const totalPago = filtradas.filter(d => d.status === 'pago').reduce((s, d) => s + d.valor, 0)
  const totalPendente = filtradas.filter(d => d.status === 'pendente').reduce((s, d) => s + d.valor, 0)

  const porCategoria = Object.entries(
    despesas.reduce((acc, d) => {
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
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                  ) : filtradas.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Nenhuma despesa encontrada.</td></tr>
                  ) : filtradas.map((d, idx) => {
                    const sc = statusConfig[d.status as keyof typeof statusConfig]
                    const cor = CORES[porCategoria.findIndex(c => c.name === (d.categorias_financeiras?.nome ?? 'Outros')) % CORES.length] || CORES[0]
                    return (
                      <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
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
                      <td />
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

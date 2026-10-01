'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Repeat, CalendarRange, Users, Receipt, ArrowUpRight, ArrowDownRight, AlertTriangle, Download } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { formatCurrency, formatDate, cn, addMonthsISO } from '@/lib/utils'
import { hojeISO, baixarCSV } from '@/lib/financeiro'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Assinante = {
  id: string; nome: string; plano: string | null; mrr: number; status: string
  data_inicio: string | null; data_cancelamento: string | null; created_at: string
  produtos: { nome: string; cor: string } | null
}

type Retainer = { descricao: string; valor: number; frequencia: string | null; clientes: { nome: string } | null }

const COR_SERVICOS = '#7C3AED'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl">
      <p className="text-brand-lavanda/60 mb-1">{label}</p>
      <p className="font-bold text-brand-lima">MRR: {formatCurrency(payload[0].value)}</p>
      <p className="text-brand-lavanda/50">{payload[0].payload.ativos} assinante(s)</p>
    </div>
  )
}

export default function MrrPage() {
  const pathname = usePathname()
  const [assinantes, setAssinantes] = useState<Assinante[]>([])
  const [retainers, setRetainers] = useState<Retainer[]>([])
  const [loading, setLoading] = useState(true)
  const hoje = hojeISO()
  const mesAtual = hoje.slice(0, 7)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    Promise.all([
      db.from('saas_clientes').select('id, nome, plano, mrr, status, data_inicio, data_cancelamento, created_at, produtos(nome, cor)'),
      // Receitas recorrentes de serviço (retainers) com parcela neste mês. As de produto SaaS já estão no MRR dos assinantes.
      db.from('lancamentos').select('descricao, valor, frequencia, clientes(nome)')
        .eq('tipo', 'receita').eq('recorrente', true).is('produto_id', null).neq('status', 'cancelado')
        .gte('data', mesAtual + '-01').lt('data', addMonthsISO(mesAtual + '-01', 1)),
    ]).then(([a, r]: [{ data: Assinante[] | null }, { data: Retainer[] | null }]) => {
      setAssinantes(a.data ?? [])
      setRetainers(r.data ?? [])
      setLoading(false)
    })
  }, [mesAtual])

  const calc = useMemo(() => {
    const inicioDe = (a: Assinante) => a.data_inicio ?? a.created_at.slice(0, 10)
    const pagante = (a: Assinante) => a.status !== 'trial'

    const ativos = assinantes.filter(a => a.status === 'ativo')
    const inadimplentes = assinantes.filter(a => a.status === 'inadimplente')
    const trials = assinantes.filter(a => a.status === 'trial')
    const mrrSaas = ativos.reduce((s, a) => s + Number(a.mrr), 0)

    // Normaliza retainers para valor mensal.
    const fatorMensal: Record<string, number> = { mensal: 1, quinzenal: 2, semanal: 4.33, anual: 1 / 12 }
    const retainerPorChave = new Map<string, { nome: string; cliente: string | null; mensal: number }>()
    for (const r of retainers) {
      const k = `${r.descricao}||${r.clientes?.nome ?? ''}`
      if (retainerPorChave.has(k)) continue // várias parcelas no mês (semanal/quinzenal) → já normalizado pelo fator
      retainerPorChave.set(k, { nome: r.descricao, cliente: r.clientes?.nome ?? null, mensal: Number(r.valor) * (fatorMensal[r.frequencia ?? 'mensal'] ?? 1) })
    }
    const retainersLista = [...retainerPorChave.values()].sort((a, b) => b.mensal - a.mensal)
    const mrrServicos = retainersLista.reduce((s, r) => s + r.mensal, 0)
    const mrrTotal = mrrSaas + mrrServicos

    // Movimentação do mês (SaaS)
    const novos = assinantes.filter(a => pagante(a) && inicioDe(a).startsWith(mesAtual))
    const cancelados = assinantes.filter(a => a.status === 'cancelado' && a.data_cancelamento?.startsWith(mesAtual))
    const novoMrr = novos.reduce((s, a) => s + Number(a.mrr), 0)
    const churnMrr = cancelados.reduce((s, a) => s + Number(a.mrr), 0)

    // Evolução dos últimos 12 meses, reconstruída pelas datas de início/cancelamento (usa o MRR atual de cada assinante).
    const ativoEm = (a: Assinante, fimMes: string) =>
      pagante(a) && inicioDe(a) <= fimMes && (!a.data_cancelamento || a.data_cancelamento > fimMes)
    const serie = Array.from({ length: 12 }, (_, i) => {
      const ini = addMonthsISO(mesAtual + '-01', i - 11)
      const [y, m] = ini.split('-').map(Number)
      const fimMes = i === 11 ? hoje : `${ini.slice(0, 8)}${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
      const lista = assinantes.filter(a => ativoEm(a, fimMes))
      const lbl = format(parseISO(ini), 'MMM/yy', { locale: ptBR })
      return { mes: lbl.charAt(0).toUpperCase() + lbl.slice(1), mesKey: ini.slice(0, 7), mrr: lista.reduce((s, a) => s + Number(a.mrr), 0), ativos: lista.length }
    })

    // Churn de logos: cancelados no mês ÷ base no início do mês. Média dos últimos 6 meses fechados + atual.
    const churnMes = (mesKey: string) => {
      const inicio = mesKey + '-01'
      const base = assinantes.filter(a => pagante(a) && inicioDe(a) < inicio && (!a.data_cancelamento || a.data_cancelamento >= inicio)).length
      const perdidos = assinantes.filter(a => a.data_cancelamento?.startsWith(mesKey)).length
      return base ? perdidos / base : 0
    }
    const churnAtual = churnMes(mesAtual)
    const churnMedio = serie.slice(-6).reduce((s, m) => s + churnMes(m.mesKey), 0) / 6

    const arpa = ativos.length ? mrrSaas / ativos.length : 0
    const ltv = churnMedio > 0 ? arpa / churnMedio : null
    const mrr12Atras = serie[0].mrr
    const crescimento = mrr12Atras > 0 ? (serie[11].mrr - mrr12Atras) / mrr12Atras : null

    const porProduto = Object.entries(
      ativos.reduce((acc, a) => {
        const nome = a.produtos?.nome ?? 'Sem produto'
        acc[nome] = acc[nome] ?? { valor: 0, cor: a.produtos?.cor ?? '#B8F000', qtd: 0 }
        acc[nome].valor += Number(a.mrr)
        acc[nome].qtd += 1
        return acc
      }, {} as Record<string, { valor: number; cor: string; qtd: number }>)
    ).sort((a, b) => b[1].valor - a[1].valor)

    const movimentos = [
      ...assinantes.filter(a => pagante(a) && inicioDe(a) >= addMonthsISO(hoje, -2)).map(a => ({ tipo: 'novo' as const, data: inicioDe(a), a })),
      ...assinantes.filter(a => a.data_cancelamento && a.data_cancelamento >= addMonthsISO(hoje, -2)).map(a => ({ tipo: 'churn' as const, data: a.data_cancelamento!, a })),
    ].sort((x, y) => y.data.localeCompare(x.data)).slice(0, 10)

    return {
      ativos, inadimplentes, trials, mrrSaas, mrrServicos, mrrTotal, retainersLista,
      novos, cancelados, novoMrr, churnMrr, serie, churnAtual, churnMedio, arpa, ltv, crescimento, porProduto, movimentos,
      mrrRisco: inadimplentes.reduce((s, a) => s + Number(a.mrr), 0),
      mrrTrial: trials.reduce((s, a) => s + Number(a.mrr), 0),
    }
  }, [assinantes, retainers, hoje, mesAtual])

  const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`

  function exportar() {
    baixarCSV(`mrr-${hoje}.csv`, ['Mês', 'MRR SaaS', 'Assinantes'], calc.serie.map(m => [m.mes, m.mrr, String(m.ativos)]))
  }

  const kpis = [
    { label: 'MRR total', valor: formatCurrency(calc.mrrTotal), sub: `SaaS ${formatCurrency(calc.mrrSaas)} · Serviços ${formatCurrency(calc.mrrServicos)}`, icon: Repeat, cor: 'text-brand-lima', bg: 'bg-brand-lima/10' },
    { label: 'ARR (MRR × 12)', valor: formatCurrency(calc.mrrTotal * 12), sub: calc.crescimento === null ? 'Receita anual recorrente' : `${calc.crescimento >= 0 ? '+' : ''}${pct(calc.crescimento)} MRR SaaS em 12 meses`, icon: CalendarRange, cor: 'text-brand-lavanda', bg: 'bg-brand-violeta/10' },
    { label: 'Ticket médio (ARPA)', valor: formatCurrency(calc.arpa), sub: `${calc.ativos.length} assinante(s) ativo(s)`, icon: Users, cor: 'text-brand-lavanda', bg: 'bg-brand-violeta/10' },
    { label: 'Churn do mês', valor: pct(calc.churnAtual), sub: `Média 6m ${pct(calc.churnMedio)}${calc.ltv ? ` · LTV ≈ ${formatCurrency(calc.ltv)}` : ''}`, icon: ArrowDownRight, cor: calc.churnAtual > 0.05 ? 'text-brand-rosa' : 'text-brand-lavanda', bg: 'bg-brand-rosa/10' },
  ]

  const maxProduto = Math.max(...calc.porProduto.map(([, v]) => v.valor), calc.mrrServicos, 1)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Receita recorrente" />
      <main className="flex-1 p-6">
        <PageHeader title="MRR" description="Receita mensal recorrente — assinaturas SaaS e contratos de serviço">
          <Button variant="outline" size="sm" onClick={exportar} disabled={loading}><Download className="h-4 w-4" /> Exportar CSV</Button>
          <Link href="/saas"><Button variant="outline" size="sm">Gerenciar assinantes</Button></Link>
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
                  <p className={cn('text-xl font-bold', k.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>{loading ? '...' : k.valor}</p>
                  <p className="text-[11px] text-brand-lavanda/40 truncate">{k.sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Evolução do MRR SaaS (12 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[220px] flex items-center justify-center text-brand-lavanda/30 text-sm">Carregando...</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={calc.serie} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#B8F000" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#B8F000" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.15)" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area dataKey="mrr" type="monotone" stroke="#B8F000" strokeWidth={2} fill="url(#mrrGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Movimento do mês</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-brand-lavanda/70"><ArrowUpRight className="h-4 w-4 text-brand-lima" /> Novo MRR ({calc.novos.length})</span>
                <span className="font-semibold text-brand-lima">+{formatCurrency(calc.novoMrr)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-brand-lavanda/70"><ArrowDownRight className="h-4 w-4 text-brand-rosa" /> Churn ({calc.cancelados.length})</span>
                <span className="font-semibold text-brand-rosa">-{formatCurrency(calc.churnMrr)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                <span className="text-brand-lavanda/70">MRR líquido</span>
                <span className={cn('font-bold', calc.novoMrr - calc.churnMrr >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>
                  {calc.novoMrr - calc.churnMrr >= 0 ? '+' : ''}{formatCurrency(calc.novoMrr - calc.churnMrr)}
                </span>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5 text-yellow-400"><AlertTriangle className="h-3 w-3" /> Em risco (inadimplentes: {calc.inadimplentes.length})</span>
                  <span className="text-brand-lavanda">{formatCurrency(calc.mrrRisco)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-lavanda/50">Em trial ({calc.trials.length}) — potencial</span>
                  <span className="text-brand-lavanda">{formatCurrency(calc.mrrTrial)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Composição do MRR</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {calc.porProduto.length === 0 && calc.mrrServicos === 0 ? (
                <p className="text-xs text-brand-lavanda/40 py-6 text-center">Sem receita recorrente ativa.</p>
              ) : (
                <>
                  {calc.porProduto.map(([nome, v]) => (
                    <div key={nome} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-lavanda/80">{nome} <span className="text-xs text-brand-lavanda/40">· {v.qtd} assinante(s)</span></span>
                        <span className="font-medium text-brand-lavanda">{formatCurrency(v.valor)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(v.valor / maxProduto) * 100}%`, background: v.cor }} />
                      </div>
                    </div>
                  ))}
                  {calc.mrrServicos > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-lavanda/80">Serviços recorrentes <span className="text-xs text-brand-lavanda/40">· {calc.retainersLista.length} contrato(s)</span></span>
                        <span className="font-medium text-brand-lavanda">{formatCurrency(calc.mrrServicos)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(calc.mrrServicos / maxProduto) * 100}%`, background: COR_SERVICOS }} />
                      </div>
                      <div className="pt-1 space-y-1">
                        {calc.retainersLista.slice(0, 5).map(r => (
                          <div key={r.nome + r.cliente} className="flex justify-between text-xs text-brand-lavanda/50">
                            <span className="truncate">{r.nome}{r.cliente ? ` · ${r.cliente}` : ''}</span>
                            <span className="shrink-0">{formatCurrency(r.mensal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Últimas movimentações</CardTitle></CardHeader>
            <CardContent className="p-0">
              {calc.movimentos.length === 0 ? (
                <p className="text-xs text-brand-lavanda/40 py-10 text-center">Nenhuma entrada ou cancelamento nos últimos 2 meses.</p>
              ) : calc.movimentos.map((m) => (
                <div key={m.tipo + m.a.id} className="flex items-center gap-3 px-6 py-2.5 border-b border-white/[0.04] last:border-0">
                  {m.tipo === 'novo'
                    ? <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-lima" />
                    : <ArrowDownRight className="h-4 w-4 shrink-0 text-brand-rosa" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-brand-lavanda truncate">{m.a.nome}</p>
                    <p className="text-[11px] text-brand-lavanda/40">{m.a.produtos?.nome ?? '—'}{m.a.plano ? ` · ${m.a.plano}` : ''} · {formatDate(m.data)}</p>
                  </div>
                  <Badge variant={m.tipo === 'novo' ? 'concluido' : 'urgente'}>
                    {m.tipo === 'novo' ? '+' : '-'}{formatCurrency(Number(m.a.mrr))}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <p className="text-[11px] text-brand-lavanda/30 mt-3 flex items-center gap-1.5">
          <Receipt className="h-3 w-3" />
          MRR SaaS considera assinantes ativos (inadimplentes ficam como &quot;em risco&quot;). Serviços recorrentes vêm das receitas recorrentes sem produto SaaS com parcela neste mês. A evolução histórica usa o valor atual de cada assinatura.
        </p>
      </main>
    </div>
  )
}

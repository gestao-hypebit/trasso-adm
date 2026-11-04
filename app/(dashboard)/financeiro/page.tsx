'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, TrendingDown, Scale, Target, Wallet, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LancamentoForm } from '@/components/financeiro/lancamento-form'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { SeletorMes, periodoInicial, intervaloPeriodo, rotuloPeriodo, type Periodo } from '@/components/financeiro/seletor-mes'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { labelLinha, type Linha } from '@/lib/financeiro/linhas'
import { FiltroLinha, type FiltroLinhaValor } from '@/components/financeiro/filtro-linha'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Carregando } from '@/components/ui/carregando'

type Lancamento = {
  id: string; tipo: string; descricao: string; valor: number; data: string; status: string
  forma_pagamento: string | null
  frente: Linha
  categorias_financeiras: { nome: string } | null
  clientes: { nome: string } | null
}

type DiaFluxo = { dia: string; entradas: number; saidas: number; saldo: number }

// Quantos lançamentos aparecem em cada prévia; o resto fica em Contas a Receber/Pagar.
const ITENS_NA_PREVIA = 6

const soma = (itens: Lancamento[]) => itens.reduce((s, l) => s + l.valor, 0)

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
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [linha, setLinha] = useState<FiltroLinhaValor>('todas')

  const [inicio, fim] = intervaloPeriodo(periodo)
  const mesLabel = rotuloPeriodo(periodo)

  const load = useCallback(async () => {
    const supabase = createClient() as any
    const { data } = await supabase
      .from('lancamentos')
      .select('id, tipo, descricao, valor, data, status, forma_pagamento, frente, categorias_financeiras(nome), clientes(nome)')
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

  async function confirmarLancamento(id: string, tipo: string) {
    setConfirmingId(id)
    const novoStatus = tipo === 'receita' ? 'recebido' : 'pago'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any).from('lancamentos').update({ status: novoStatus }).eq('id', id)
    if (!error) setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status: novoStatus } : l))
    setConfirmingId(null)
  }

  // Filtro de linha: vale para tudo abaixo, menos o saldo (a conta é uma só)
  // e o "Resultado por linha", que já mostra a divisão.
  const daLinha = linha === 'todas' ? lancamentos : lancamentos.filter(l => l.frente === linha)
  const noPeriodo = lancamentos.filter(l => l.data >= inicio && l.data <= fim)
  const doMes = daLinha.filter(l => l.data >= inicio && l.data <= fim)
  const receitasMes = doMes.filter(l => l.tipo === 'receita' && l.status !== 'cancelado')
  const despesasMes = doMes.filter(l => l.tipo === 'despesa' && l.status !== 'cancelado')
  const totalRecebido = soma(receitasMes.filter(l => l.status === 'recebido'))
  const totalPago = soma(despesasMes.filter(l => l.status === 'pago'))
  const aReceber = soma(receitasMes.filter(l => l.status === 'pendente'))
  const aPagar = soma(despesasMes.filter(l => l.status === 'pendente'))
  const resultado = totalRecebido - totalPago

  // Vencidos independem do mês selecionado: é o que está atrasado hoje.
  const hojeStr = format(new Date(), 'yyyy-MM-dd')
  const vencidos = daLinha.filter(l => l.status === 'pendente' && l.data < hojeStr)
  const vencidoReceber = vencidos.filter(l => l.tipo === 'receita')
  const vencidoPagar = vencidos.filter(l => l.tipo === 'despesa')

  const saldoAtual = lancamentos.reduce((s, l) => {
    if (l.tipo === 'receita' && l.status === 'recebido') return s + l.valor
    if (l.tipo === 'despesa' && l.status === 'pago') return s - l.valor
    return s
  }, 0)

  const cashflowData: DiaFluxo[] = (() => {
    if (periodo.tudo) {
      const porMes: Record<string, { entradas: number; saidas: number }> = {}
      for (const l of [...daLinha].sort((a, b) => a.data.localeCompare(b.data))) {
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
    { label: 'Recebido', valor: totalRecebido, sub: aReceber > 0 ? `Falta receber ${formatCurrency(aReceber)}` : 'Nada em aberto para receber', icon: TrendingUp, cor: 'text-brand-lima', bgIcon: 'bg-brand-lima/10' },
    { label: 'Pago', valor: totalPago, sub: aPagar > 0 ? `Falta pagar ${formatCurrency(aPagar)}` : 'Nada em aberto para pagar', icon: TrendingDown, cor: 'text-brand-rosa', bgIcon: 'bg-brand-rosa/10' },
    { label: 'Resultado', valor: resultado, sub: 'Recebido − pago', icon: Scale, cor: resultado >= 0 ? 'text-brand-lima' : 'text-brand-rosa', bgIcon: 'bg-brand-violeta/10' },
    { label: 'Previsão de fechamento', valor: resultado + aReceber - aPagar, sub: 'Se tudo em aberto for pago', icon: Target, cor: 'text-brand-lavanda', bgIcon: 'bg-brand-violeta/10' },
  ]

  // Resultado de cada linha de receita no período.
  const porFrente = (['agencia', 'catalogo_place', 'clubelly', 'geral'] as const).map(f => {
    const itens = noPeriodo.filter(l => l.frente === f)
    const receitas = itens.filter(l => l.tipo === 'receita' && l.status === 'recebido').reduce((s, l) => s + l.valor, 0)
    const despesas = itens.filter(l => l.tipo === 'despesa' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
    return { frente: f, label: f === 'geral' ? 'Custos gerais' : labelLinha(f), receitas, despesas, resultado: receitas - despesas }
  })
  const totalPorFrente = {
    receitas: porFrente.reduce((s, f) => s + f.receitas, 0),
    despesas: porFrente.reduce((s, f) => s + f.despesas, 0),
  }

  const acoesPrevia = { loading, mesLabel, deletingId, confirmingId, setDeletingId, onExcluir: deleteLancamento, onConfirmar: confirmarLancamento }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Visão geral" />
      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="Financeiro" description={loading ? 'Carregando…' : mesLabel}>
          <LancamentoForm onSuccess={load} />
        </PageHeader>

        <FinanceiroSubNav pathname={pathname} />

        {!loading && vencidos.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 rounded-xl border border-brand-rosa/20 bg-brand-rosa/[0.05] px-4 py-3 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-brand-rosa" />
            {vencidoReceber.length > 0 && (
              <Link href="/financeiro/receitas?aba=vencidas" className="text-brand-lavanda hover:text-brand-lima transition-colors">
                <span className="font-semibold">{vencidoReceber.length}</span> {vencidoReceber.length === 1 ? 'cobrança vencida' : 'cobranças vencidas'} · <span className="font-semibold text-brand-rosa">{formatCurrency(soma(vencidoReceber))}</span>
              </Link>
            )}
            {vencidoPagar.length > 0 && (
              <Link href="/financeiro/despesas?aba=vencidas" className="text-brand-lavanda hover:text-brand-lima transition-colors">
                <span className="font-semibold">{vencidoPagar.length}</span> {vencidoPagar.length === 1 ? 'conta vencida' : 'contas vencidas'} · <span className="font-semibold text-brand-rosa">{formatCurrency(soma(vencidoPagar))}</span>
              </Link>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <SeletorMes valor={periodo} onChange={setPeriodo} permitirFuturo />
          <FiltroLinha valor={linha} onChange={setLinha} />
          {linha !== 'todas' && <span className="text-[11px] text-brand-lavanda/40">Custos gerais (contabilidade, impostos…) ficam de fora.</span>}
        </div>

        {/* Saldo em Conta */}
        <div className="rounded-2xl border border-brand-lima/25 bg-gradient-to-r from-brand-lima/[0.07] to-transparent p-5 flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-brand-lavanda/50 mb-1 uppercase tracking-wide">Saldo em Conta</p>
            <p className={cn('text-3xl font-bold', saldoAtual >= 0 ? 'text-brand-lima' : 'text-brand-rosa')} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {loading ? '...' : formatCurrency(saldoAtual)}
            </p>
            <p className="text-xs text-brand-lavanda/30 mt-1">Total recebido − total pago, em todos os meses</p>
          </div>
          <Wallet className="h-8 w-8 text-brand-lima/25 shrink-0" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-5">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl mb-3', kpi.bgIcon)}>
                  <kpi.icon className={cn('h-5 w-5', kpi.cor)} />
                </div>
                <p className={cn('text-2xl font-bold mb-1', kpi.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {loading ? '...' : formatCurrency(kpi.valor)}
                </p>
                <p className="text-xs text-brand-lavanda/50">{kpi.label} · {periodo.tudo ? 'total' : mesLabel.toLowerCase()}</p>
                <p className="text-xs text-brand-lavanda/30 mt-0.5">{kpi.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {!loading && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resultado por linha</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-2.5">Linha</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-2.5">Recebido</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-2.5">Pago</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-6 py-2.5">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porFrente.map(f => (
                      <tr key={f.frente} className="border-b border-white/[0.04]">
                        <td className="px-6 py-2.5 text-brand-lavanda">{f.label}</td>
                        <td className="px-4 py-2.5 text-right text-brand-lavanda/70">{formatCurrency(f.receitas)}</td>
                        <td className="px-4 py-2.5 text-right text-brand-lavanda/70">−{formatCurrency(f.despesas)}</td>
                        <td className={cn('px-6 py-2.5 text-right font-semibold', f.resultado >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>{formatCurrency(f.resultado)}</td>
                      </tr>
                    ))}
                    <tr className="bg-white/[0.02] font-semibold">
                      <td className="px-6 py-2.5 text-brand-lavanda">Total</td>
                      <td className="px-4 py-2.5 text-right text-brand-lavanda">{formatCurrency(totalPorFrente.receitas)}</td>
                      <td className="px-4 py-2.5 text-right text-brand-lavanda">−{formatCurrency(totalPorFrente.despesas)}</td>
                      <td className={cn('px-6 py-2.5 text-right', totalPorFrente.receitas - totalPorFrente.despesas >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>{formatCurrency(totalPorFrente.receitas - totalPorFrente.despesas)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="px-6 py-3 text-[11px] text-brand-lavanda/40">Custos gerais são os da empresa toda (contabilidade, impostos…). Dá para mudar a linha de cada lançamento em Contas a Receber e Contas a Pagar.</p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Evolução do resultado</CardTitle>
          </CardHeader>
          <CardContent>
            {cashflowData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-brand-lavanda/30 text-sm">Sem movimentações no período</div>
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
                  <YAxis tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : String(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="saldo" stroke="#7C3AED" strokeWidth={2} fill="url(#gradSaldo)" name="saldo" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PreviaLancamentos titulo="Receitas" href="/financeiro/receitas" itens={receitasMes} liquidado="recebido" {...acoesPrevia} />
          <PreviaLancamentos titulo="Despesas" href="/financeiro/despesas" itens={despesasMes} liquidado="pago" {...acoesPrevia} />
        </div>
      </main>
    </div>
  )
}

function PreviaLancamentos({ titulo, href, itens, liquidado, loading, mesLabel, deletingId, confirmingId, setDeletingId, onExcluir, onConfirmar }: {
  titulo: string
  href: string
  itens: Lancamento[]
  liquidado: 'recebido' | 'pago'
  loading: boolean
  mesLabel: string
  deletingId: string | null
  confirmingId: string | null
  setDeletingId: (id: string | null) => void
  onExcluir: (id: string) => void
  onConfirmar: (id: string, tipo: string) => void
}) {
  const ehReceita = liquidado === 'recebido'
  const Icone = ehReceita ? TrendingUp : TrendingDown
  const corValor = ehReceita ? 'text-brand-lima' : 'text-brand-rosa'
  const rotuloLiquidado = ehReceita ? 'Recebido' : 'Pago'
  // Mais recentes primeiro; a lista vem do banco já ordenada por data.
  const previa = itens.slice(0, ITENS_NA_PREVIA)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icone className={cn('h-4 w-4', corValor)} />
          <CardTitle className="text-base">{titulo}</CardTitle>
          <span className="text-xs text-brand-lavanda/40 font-normal">{mesLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-white/[0.04]">
          {loading ? (
            <p className="text-center text-brand-lavanda/40 text-sm py-8"><Carregando /></p>
          ) : previa.length === 0 ? (
            <p className="text-center text-brand-lavanda/40 text-sm py-8">Nada neste período.</p>
          ) : previa.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-brand-lavanda font-medium truncate">{l.descricao}</p>
                <p className="text-xs text-brand-lavanda/40 mt-0.5 truncate">
                  {l.categorias_financeiras?.nome ?? '—'}{l.clientes?.nome ? ` · ${l.clientes.nome}` : ''} · {formatDate(l.data)}
                </p>
              </div>
              <span className={cn('text-sm font-semibold shrink-0', corValor)}>{ehReceita ? '+' : '-'}{formatCurrency(l.valor)}</span>
              <Badge variant={l.status === liquidado ? 'concluido' : 'pendente'} className="shrink-0">
                {l.status === liquidado ? rotuloLiquidado : 'Em aberto'}
              </Badge>
              <div className="shrink-0 flex items-center gap-1">
                {l.status === 'pendente' && deletingId !== l.id && (
                  <button
                    onClick={() => onConfirmar(l.id, l.tipo)}
                    disabled={confirmingId === l.id}
                    className="flex h-6 w-6 items-center justify-center rounded text-brand-lavanda/0 group-hover:text-brand-lavanda/30 hover:!text-brand-lima hover:bg-brand-lima/10 transition-colors disabled:opacity-50"
                    title={`Marcar como ${liquidado}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {deletingId === l.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => onExcluir(l.id)} className="text-[11px] text-brand-rosa font-medium">Excluir</button>
                    <span className="text-brand-lavanda/20">·</span>
                    <button onClick={() => setDeletingId(null)} className="text-[11px] text-brand-lavanda/40">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => setDeletingId(l.id)} title="Excluir" className="flex h-6 w-6 items-center justify-center rounded text-brand-lavanda/0 group-hover:text-brand-lavanda/25 hover:!text-brand-rosa hover:bg-brand-rosa/10 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {itens.length > 0 && (
          <Link href={href} className="block border-t border-white/[0.06] px-4 py-2.5 text-center text-xs text-brand-violeta hover:text-brand-lima transition-colors">
            Ver {itens.length === 1 ? 'o lançamento' : `todos os ${itens.length} lançamentos`} →
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

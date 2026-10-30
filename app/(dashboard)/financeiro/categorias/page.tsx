'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { format, startOfMonth, subMonths, differenceInCalendarMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { SeletorMes, periodoInicial, intervaloPeriodo, rotuloPeriodo, type Periodo } from '@/components/financeiro/seletor-mes'
import { FiltroLinha, type FiltroLinhaValor } from '@/components/financeiro/filtro-linha'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Linha } from '@/lib/financeiro/linhas'
import { Carregando } from '@/components/ui/carregando'

type Receita = {
  id: string; descricao: string; valor: number; data: string; status: string; frente: Linha
  categorias_financeiras: { nome: string } | null
  clientes: { nome: string } | null
}

type Base = 'recebido' | 'previsto'

const SEM_CATEGORIA = 'Sem categoria'
const VIOLETA = '#7C3AED'
const nomeCategoria = (r: Receita) => r.categorias_financeiras?.nome ?? SEM_CATEGORIA

function compacto(v: number) {
  if (v >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  return String(Math.round(v))
}

const TooltipMes = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] px-3 py-2 text-xs shadow-xl">
      <p className="mb-0.5 capitalize text-brand-lavanda/60">{p.rotuloLongo}</p>
      <p className="font-semibold text-brand-lavanda">{formatCurrency(p.valor)}</p>
      <p className="text-brand-lavanda/40">{p.qtd} lançamento{p.qtd !== 1 ? 's' : ''}</p>
    </div>
  )
}

// De onde vem a receita: ranking por categoria no período e a evolução mês a mês.
export default function ReceitasPorCategoriaPage() {
  const pathname = usePathname()
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial)
  const [linha, setLinha] = useState<FiltroLinhaValor>('todas')
  const [base, setBase] = useState<Base>('recebido')
  const [selecionada, setSelecionada] = useState<string | null>(null)

  useEffect(() => {
    ;(createClient() as any)
      .from('lancamentos')
      .select('id, descricao, valor, data, status, frente, categorias_financeiras(nome), clientes(nome)')
      .eq('tipo', 'receita')
      .neq('status', 'cancelado')
      .then(({ data }: { data: Receita[] | null }) => {
        setReceitas(data ?? [])
        setLoading(false)
      })
  }, [])

  // Recebido = o que já entrou; previsto = recebido + em aberto.
  const validas = useMemo(
    () => receitas.filter(r => (base === 'previsto' || r.status === 'recebido') && (linha === 'todas' || r.frente === linha)),
    [receitas, base, linha],
  )

  const [ini, fim] = intervaloPeriodo(periodo)
  const doPeriodo = validas.filter(r => r.data >= ini && r.data <= fim)
  const total = doPeriodo.reduce((s, r) => s + r.valor, 0)

  const ranking = Object.values(
    doPeriodo.reduce((acc, r) => {
      const nome = nomeCategoria(r)
      acc[nome] ??= { nome, valor: 0, qtd: 0 }
      acc[nome].valor += r.valor
      acc[nome].qtd += 1
      return acc
    }, {} as Record<string, { nome: string; valor: number; qtd: number }>),
  ).sort((a, b) => b.valor - a.valor)
  const maior = ranking[0]?.valor ?? 0

  // Evolução: com um mês escolhido, os 12 meses até ele; em "desde o início",
  // do primeiro ao último lançamento, para a soma das colunas bater com o ranking.
  const fimSerie = (() => {
    if (!periodo.tudo) return startOfMonth(periodo.mes)
    const ultimo = validas.reduce((m, r) => (r.data > m ? r.data : m), format(new Date(), 'yyyy-MM-dd'))
    return new Date(ultimo.slice(0, 7) + '-01T12:00:00')
  })()
  const meses = (() => {
    if (!periodo.tudo) return 12
    const primeira = validas.reduce((m, r) => (r.data < m ? r.data : m), format(fimSerie, 'yyyy-MM-dd'))
    return differenceInCalendarMonths(fimSerie, new Date(primeira.slice(0, 7) + '-01T12:00:00')) + 1
  })()
  const serie = Array.from({ length: meses }, (_, i) => {
    const mes = subMonths(fimSerie, meses - 1 - i)
    const chave = format(mes, 'yyyy-MM')
    const itens = validas.filter(r => r.data.startsWith(chave) && (!selecionada || nomeCategoria(r) === selecionada))
    const curto = format(mes, 'MMM', { locale: ptBR })
    return {
      chave,
      rotulo: curto.charAt(0).toUpperCase() + curto.slice(1, 3),
      rotuloLongo: format(mes, 'MMMM yyyy', { locale: ptBR }),
      valor: itens.reduce((s, r) => s + r.valor, 0),
      qtd: itens.length,
    }
  })
  const totalSerie = serie.reduce((s, m) => s + m.valor, 0)
  const rotuloSerie = periodo.tudo ? `desde o início (${meses} meses)` : `últimos 12 meses`
  const mesesComValor = serie.filter(m => m.valor > 0).length
  const melhorMes = serie.reduce((a, b) => (b.valor > a.valor ? b : a), serie[0])
  const mesAtivo = periodo.tudo ? null : format(periodo.mes, 'yyyy-MM')

  const doSelecionado = selecionada ? ranking.find(c => c.nome === selecionada) : null
  const lancamentosSel = selecionada
    ? doPeriodo.filter(r => nomeCategoria(r) === selecionada).sort((a, b) => b.data.localeCompare(a.data))
    : []

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Receitas por categoria" />
      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="Receitas por categoria" description="De onde vem o faturamento e como cada serviço evolui mês a mês" />
        <FinanceiroSubNav pathname={pathname} />

        {/* Filtros numa linha só, acima dos gráficos */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <SeletorMes valor={periodo} onChange={setPeriodo} />
          <FiltroLinha valor={linha} onChange={setLinha} />
          <div className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
            {([['recebido', 'Recebido'], ['previsto', 'Recebido + a receber']] as const).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setBase(v)}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors', base === v ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/40 hover:text-brand-lavanda/70')}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-brand-lavanda/50">{base === 'recebido' ? 'Faturado' : 'Faturamento previsto'} · {rotuloPeriodo(periodo).toLowerCase()}</p>
              <p className="mt-1 text-3xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{loading ? '...' : formatCurrency(total)}</p>
              <p className="mt-0.5 text-xs text-brand-lavanda/40">{doPeriodo.length} lançamento{doPeriodo.length !== 1 ? 's' : ''} em {ranking.length} categoria{ranking.length !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-brand-lavanda/50">Maior fonte de receita</p>
              <p className="mt-1 truncate text-xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{ranking[0]?.nome ?? '—'}</p>
              <p className="mt-0.5 text-xs text-brand-lavanda/40">
                {ranking[0] ? `${formatCurrency(ranking[0].valor)} · ${Math.round((ranking[0].valor / total) * 100)}% do total` : 'Sem receitas no período'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-brand-lavanda/50">Média mensal · {rotuloSerie}{selecionada ? ` · ${selecionada}` : ''}</p>
              <p className="mt-1 text-xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{loading ? '...' : formatCurrency(totalSerie / meses)}</p>
              <p className="mt-0.5 text-xs text-brand-lavanda/40">{formatCurrency(totalSerie)} em {meses} meses · {mesesComValor} mês(es) com receita</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Ranking: barra horizontal por categoria, já com valor e % (serve de tabela) */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">De onde vem a receita</CardTitle>
              <p className="text-xs text-brand-lavanda/40">{rotuloPeriodo(periodo)} · clique numa categoria para ver a evolução dela</p>
            </CardHeader>
            <CardContent className="space-y-1 pb-4">
              {loading ? (
                <p className="py-10 text-center text-sm text-brand-lavanda/40"><Carregando /></p>
              ) : ranking.length === 0 ? (
                <p className="py-10 text-center text-sm text-brand-lavanda/40">Nenhuma receita neste período.</p>
              ) : ranking.map((c) => {
                const ativa = selecionada === c.nome
                return (
                  <button
                    key={c.nome}
                    type="button"
                    onClick={() => setSelecionada(ativa ? null : c.nome)}
                    className={cn('w-full rounded-lg px-3 py-2 text-left transition-colors', ativa ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')}
                  >
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className={cn('truncate', ativa ? 'font-semibold text-brand-lavanda' : 'text-brand-lavanda/80')}>{c.nome}</span>
                      <span className="shrink-0 font-semibold text-brand-lavanda">{formatCurrency(c.valor)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 flex-1">
                        <div
                          className="h-full rounded-r-[4px] transition-all"
                          style={{ width: `${Math.max((c.valor / maior) * 100, 1)}%`, background: VIOLETA, opacity: selecionada && !ativa ? 0.35 : 1 }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-[11px] text-brand-lavanda/50">
                        {Math.round((c.valor / total) * 100)}% · {c.qtd} lanç.
                      </span>
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Evolução mensal da categoria escolhida (ou de todas) */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Evolução mês a mês · {selecionada ?? 'todas as categorias'}</CardTitle>
                  <p className="text-xs text-brand-lavanda/40">
                    {rotuloSerie.charAt(0).toUpperCase() + rotuloSerie.slice(1)}{melhorMes?.valor > 0 ? ` · melhor mês: ${melhorMes.rotuloLongo} (${formatCurrency(melhorMes.valor)})` : ''}
                  </p>
                </div>
                {selecionada && (
                  <button type="button" onClick={() => setSelecionada(null)} className="text-xs text-brand-lavanda/50 hover:text-brand-lavanda">
                    Ver todas
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {doSelecionado === undefined && selecionada && (
                <p className="mb-2 text-[11px] text-brand-lavanda/40">Essa categoria não teve receita em {rotuloPeriodo(periodo).toLowerCase()}, mas aparece nos outros meses.</p>
              )}
              {totalSerie === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-brand-lavanda/30">Sem receitas no período</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={serie} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(232,228,248,0.07)" />
                    <XAxis dataKey="rotulo" tick={{ fill: 'rgba(232,228,248,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(232,228,248,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compacto} width={40} />
                    <Tooltip content={<TooltipMes />} cursor={{ fill: 'rgba(232,228,248,0.05)' }} />
                    <Bar dataKey="valor" maxBarSize={24} radius={[4, 4, 0, 0]}>
                      {serie.map((m) => (
                        <Cell key={m.chave} fill={VIOLETA} fillOpacity={!mesAtivo || m.chave === mesAtivo ? 1 : 0.45} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {mesAtivo && <p className="mt-2 text-[11px] text-brand-lavanda/40">A barra mais forte é o mês selecionado no filtro.</p>}
            </CardContent>
          </Card>
        </div>

        {/* Lançamentos que formam o valor da categoria escolhida, no período */}
        {selecionada && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle className="text-base">Lançamentos de {selecionada} · {rotuloPeriodo(periodo).toLowerCase()}</CardTitle>
                <span className="text-xs text-brand-lavanda/50">{lancamentosSel.length} lançamento{lancamentosSel.length !== 1 ? 's' : ''} · <span className="font-semibold text-brand-lavanda">{formatCurrency(doSelecionado?.valor ?? 0)}</span></span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {lancamentosSel.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-brand-lavanda/40">Nenhum lançamento dessa categoria em {rotuloPeriodo(periodo).toLowerCase()}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="px-6 py-2.5 text-left text-xs font-medium text-brand-lavanda/50">Data</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-brand-lavanda/50">Descrição</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-brand-lavanda/50">Cliente</th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium text-brand-lavanda/50">Situação</th>
                        <th className="px-6 py-2.5 text-right text-xs font-medium text-brand-lavanda/50">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentosSel.map((r) => (
                        <tr key={r.id} className="border-b border-white/[0.04]">
                          <td className="whitespace-nowrap px-6 py-2.5 text-xs text-brand-lavanda/60">{formatDate(r.data)}</td>
                          <td className="px-3 py-2.5 text-brand-lavanda">{r.descricao}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-brand-lavanda/70">{r.clientes?.nome ?? '—'}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge variant={r.status === 'recebido' ? 'concluido' : 'pendente'}>{r.status === 'recebido' ? 'Recebido' : 'A receber'}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-6 py-2.5 text-right font-semibold text-brand-lavanda">{formatCurrency(r.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Info } from 'lucide-react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, toISODateLocal, addMonthsISO, cn } from '@/lib/utils'

// Paleta validada (CVD + contraste) contra a superfície escura #141318.
const COR = { confirmado: '#76A000', saas: '#8B5CF6', pipeline: '#2E9FD0', despesas: '#E0457B' }

type Lanc = { tipo: string; valor: number; data: string; produto_id: string | null }
type Assinante = { mrr: number; status: string; produto_id: string; produtos: { nome: string } | null }
type Proposta = { id: string; numero: string; titulo: string; status: string; valor_final: number; validade: string | null; clientes: { nome: string } | null }
type Mes = { key: string; label: string; confirmado: number; saas: number; pipeline: number; total: number; despesas: number; saldo: number }

const HORIZONTES = [3, 6, 12]

function TooltipPrevisao({ active, payload }: { active?: boolean; payload?: { payload: Mes }[] }) {
  if (!active || !payload?.length) return null
  const m = payload[0].payload
  const linhas = [
    { cor: COR.confirmado, label: 'A receber (confirmado)', valor: m.confirmado },
    { cor: COR.saas, label: 'MRR SaaS', valor: m.saas },
    { cor: COR.pipeline, label: 'Pipeline ponderado', valor: m.pipeline },
    { cor: COR.despesas, label: 'Despesas previstas', valor: m.despesas },
  ]
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl min-w-56">
      <p className="text-brand-lavanda font-semibold mb-2 capitalize">{m.label}</p>
      {linhas.map((l) => (
        <div key={l.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-brand-lavanda/60"><span className="h-2 w-2 rounded-sm" style={{ background: l.cor }} />{l.label}</span>
          <span className="text-brand-lavanda font-medium">{formatCurrency(l.valor)}</span>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t border-white/[0.08] flex justify-between">
        <span className="text-brand-lavanda/60">Saldo previsto</span>
        <span className={cn('font-bold', m.saldo >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>{formatCurrency(m.saldo)}</span>
      </div>
    </div>
  )
}

export default function PrevisaoPage() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<Lanc[]>([])
  const [assinantes, setAssinantes] = useState<Assinante[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [horizonte, setHorizonte] = useState(6)
  const [probEnviada, setProbEnviada] = useState(30)
  const [probNegociacao, setProbNegociacao] = useState(60)

  useEffect(() => {
    const supabase = createClient() as any
    async function load() {
      const [{ data: l }, { data: a }, { data: p }] = await Promise.all([
        supabase.from('lancamentos').select('tipo, valor, data, produto_id').eq('status', 'pendente'),
        supabase.from('saas_clientes').select('mrr, status, produto_id, produtos(nome)').in('status', ['ativo', 'trial']),
        supabase.from('propostas').select('id, numero, titulo, status, valor_final, validade, clientes(nome)').in('status', ['enviada', 'em_negociacao']),
      ])
      setLancamentos(l ?? [])
      setAssinantes(a ?? [])
      setPropostas(p ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const hoje = toISODateLocal(new Date())
  const mesAtual = hoje.slice(0, 7)

  const calc = useMemo(() => {
    const meses: Mes[] = Array.from({ length: horizonte }, (_, i) => {
      const key = addMonthsISO(`${mesAtual}-01`, i).slice(0, 7)
      const label = format(parseISO(`${key}-01`), 'MMM/yy', { locale: ptBR })
      return { key, label, confirmado: 0, saas: 0, pipeline: 0, total: 0, despesas: 0, saldo: 0 }
    })
    const porKey = Object.fromEntries(meses.map((m) => [m.key, m]))

    let atrasado = 0
    for (const l of lancamentos) {
      const valor = Number(l.valor)
      if (l.tipo === 'receita' && l.data < hoje) { atrasado += valor; continue }
      const m = porKey[l.data.slice(0, 7)]
      if (!m || l.data < hoje) continue
      // Receitas com produto SaaS já estão representadas pelo MRR dos assinantes.
      if (l.tipo === 'receita' && !l.produto_id) m.confirmado += valor
      if (l.tipo === 'despesa') m.despesas += valor
    }

    const ativos = assinantes.filter((a) => a.status === 'ativo')
    const mrr = ativos.reduce((s, a) => s + Number(a.mrr), 0)
    const mrrTrial = assinantes.filter((a) => a.status === 'trial').reduce((s, a) => s + Number(a.mrr), 0)
    for (const m of meses) m.saas = mrr

    const prob = (status: string) => (status === 'em_negociacao' ? probNegociacao : probEnviada) / 100
    for (const p of propostas) {
      // Sem data de fechamento no modelo: usa a validade (se futura) como estimativa, senão o mês atual.
      const alvo = p.validade && p.validade >= hoje ? p.validade.slice(0, 7) : mesAtual
      const m = porKey[alvo]
      if (m) m.pipeline += Number(p.valor_final) * prob(p.status)
    }

    for (const m of meses) {
      m.total = m.confirmado + m.saas + m.pipeline
      m.saldo = m.total - m.despesas
    }

    const soma = (k: keyof Mes) => meses.reduce((s, m) => s + (m[k] as number), 0)
    const mrrPorProduto: Record<string, number> = {}
    for (const a of ativos) {
      const nome = a.produtos?.nome ?? 'SaaS'
      mrrPorProduto[nome] = (mrrPorProduto[nome] ?? 0) + Number(a.mrr)
    }
    return {
      meses, atrasado, mrr, mrrTrial, qtdAtivos: ativos.length, qtdTrial: assinantes.length - ativos.length, mrrPorProduto,
      totalConfirmado: soma('confirmado'), totalSaas: soma('saas'), totalPipeline: soma('pipeline'),
      total: soma('total'), totalDespesas: soma('despesas'), saldo: soma('saldo'),
    }
  }, [lancamentos, assinantes, propostas, horizonte, probEnviada, probNegociacao, hoje, mesAtual])

  const pctSaas = calc.total > 0 ? (calc.totalSaas / calc.total) * 100 : 0
  const pctAgencia = calc.total > 0 ? ((calc.totalConfirmado + calc.totalPipeline) / calc.total) * 100 : 0

  const kpis = [
    { label: `Receita prevista (${horizonte} meses)`, valor: calc.total, sub: `${formatCurrency(calc.total / horizonte)}/mês em média`, cor: 'text-brand-lavanda' },
    { label: 'MRR SaaS', valor: calc.mrr, sub: `${calc.qtdAtivos} assinante(s) ativo(s)${calc.qtdTrial ? ` · ${calc.qtdTrial} em trial` : ''}`, cor: 'text-brand-lavanda' },
    { label: 'Pipeline ponderado', valor: calc.totalPipeline, sub: `${propostas.length} proposta(s) em aberto`, cor: 'text-brand-lavanda' },
    { label: 'Saldo previsto', valor: calc.saldo, sub: `após ${formatCurrency(calc.totalDespesas)} em despesas`, cor: calc.saldo >= 0 ? 'text-brand-lima' : 'text-brand-rosa' },
  ]

  const legenda = [
    { cor: COR.confirmado, label: 'A receber (confirmado)' },
    { cor: COR.saas, label: 'MRR SaaS' },
    { cor: COR.pipeline, label: 'Pipeline ponderado' },
    { cor: COR.despesas, label: 'Despesas previstas', linha: true },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Previsão de receita" />
      <main className="flex-1 p-6">
        <PageHeader title="Financeiro" description="Previsão de receita">
          <div className="flex rounded-lg border border-white/[0.1] p-0.5">
            {HORIZONTES.map((h) => (
              <Button key={h} size="sm" variant={horizonte === h ? 'violeta' : 'ghost'} className="h-7" onClick={() => setHorizonte(h)}>
                {h} meses
              </Button>
            ))}
          </div>
        </PageHeader>

        <FinanceiroSubNav pathname={pathname} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardContent className="p-5">
                <p className="text-xs text-brand-lavanda/50">{k.label}</p>
                <p className={cn('text-2xl font-bold mt-1', k.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {loading ? '—' : formatCurrency(k.valor)}
                </p>
                <p className="text-[11px] text-brand-lavanda/40 mt-0.5">{k.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {calc.atrasado > 0 && (
          <Link href="/financeiro/receitas" className="mb-6 flex items-center gap-2 rounded-xl border border-brand-rosa/20 bg-brand-rosa/[0.06] px-4 py-3 text-sm text-brand-rosa hover:bg-brand-rosa/10">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {formatCurrency(calc.atrasado)} em receitas vencidas e não recebidas, fora da previsão. Cobre ou atualize esses lançamentos.
          </Link>
        )}

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Receita prevista por mês</CardTitle>
              <div className="flex flex-wrap items-center gap-4 text-xs text-brand-lavanda/60">
                {legenda.map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5">
                    {l.linha
                      ? <span className="h-0.5 w-3 rounded-full" style={{ background: l.cor }} />
                      : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.cor }} />}
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[280px] flex items-center justify-center text-brand-lavanda/30 text-sm">Carregando...</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={calc.meses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="rgba(245,242,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(245,242,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(245,242,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} width={48}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                  <Tooltip content={<TooltipPrevisao />} cursor={{ fill: 'rgba(245,242,255,0.04)' }} />
                  <Bar dataKey="confirmado" stackId="r" fill={COR.confirmado} stroke="#141318" strokeWidth={2} />
                  <Bar dataKey="saas" stackId="r" fill={COR.saas} stroke="#141318" strokeWidth={2} />
                  <Bar dataKey="pipeline" stackId="r" fill={COR.pipeline} stroke="#141318" strokeWidth={2} radius={[4, 4, 0, 0]} />
                  <Line dataKey="despesas" type="monotone" stroke={COR.despesas} strokeWidth={2} strokeDasharray="5 4"
                    dot={{ r: 4, fill: COR.despesas, stroke: '#141318', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-base">Mês a mês</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Mês</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Confirmado</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">SaaS</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Pipeline</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Despesas</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.meses.map((m) => (
                      <tr key={m.key} className="border-b border-white/[0.04]">
                        <td className="px-6 py-2.5 font-medium text-brand-lavanda capitalize">{m.label}</td>
                        <td className="px-3 py-2.5 text-right text-brand-lavanda/80 whitespace-nowrap">{formatCurrency(m.confirmado)}</td>
                        <td className="px-3 py-2.5 text-right text-brand-lavanda/80 whitespace-nowrap">{formatCurrency(m.saas)}</td>
                        <td className="px-3 py-2.5 text-right text-brand-lavanda/80 whitespace-nowrap">{formatCurrency(m.pipeline)}</td>
                        <td className="px-3 py-2.5 text-right text-brand-lavanda/60 whitespace-nowrap">−{formatCurrency(m.despesas)}</td>
                        <td className={cn('px-4 py-2.5 text-right font-semibold whitespace-nowrap', m.saldo >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>{formatCurrency(m.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">De onde vem a receita</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06] gap-0.5">
                  <div style={{ width: `${pctAgencia}%`, background: COR.confirmado }} />
                  <div style={{ width: `${pctSaas}%`, background: COR.saas }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-brand-lavanda/70">Agência (projetos + pipeline) <b className="text-brand-lavanda">{pctAgencia.toFixed(0)}%</b></span>
                  <span className="text-brand-lavanda/70">SaaS <b className="text-brand-lavanda">{pctSaas.toFixed(0)}%</b></span>
                </div>
                {Object.entries(calc.mrrPorProduto).map(([nome, v]) => (
                  <div key={nome} className="flex justify-between text-xs">
                    <span className="text-brand-lavanda/50">{nome}</span>
                    <span className="text-brand-lavanda">{formatCurrency(v)}/mês</span>
                  </div>
                ))}
                {calc.mrrTrial > 0 && (
                  <p className="text-[11px] text-brand-lavanda/40">+ {formatCurrency(calc.mrrTrial)}/mês em trials ainda não contados.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Chance de fechamento</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Propostas enviadas', valor: probEnviada, set: setProbEnviada },
                  { label: 'Em negociação', valor: probNegociacao, set: setProbNegociacao },
                ].map((p) => (
                  <div key={p.label} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-brand-lavanda/70">{p.label}</span>
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} max={100} value={p.valor} className="h-8 w-16 text-right"
                        onChange={(e) => p.set(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
                      <span className="text-xs text-brand-lavanda/50">%</span>
                    </div>
                  </div>
                ))}
                <p className="flex gap-1.5 text-[11px] text-brand-lavanda/40">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  O pipeline entra no mês da validade da proposta. Receitas pendentes com produto SaaS ficam fora do &quot;confirmado&quot; para não somar duas vezes com o MRR.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {propostas.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Propostas no pipeline</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {[...propostas].sort((a, b) => b.valor_final - a.valor_final).map((p) => {
                    const pr = p.status === 'em_negociacao' ? probNegociacao : probEnviada
                    return (
                      <tr key={p.id} className="border-b border-white/[0.04]">
                        <td className="px-6 py-2.5">
                          <Link href={`/propostas/${p.id}`} className="text-brand-lavanda hover:text-brand-lima">
                            <span className="font-mono text-xs text-brand-lavanda/50 mr-2">{p.numero}</span>{p.titulo}
                          </Link>
                          <p className="text-xs text-brand-lavanda/40">{p.clientes?.nome ?? '—'}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-brand-lavanda/60 whitespace-nowrap">{p.status === 'em_negociacao' ? 'Em negociação' : 'Enviada'} · {pr}%</td>
                        <td className="px-3 py-2.5 text-right text-brand-lavanda/60 whitespace-nowrap">{formatCurrency(p.valor_final)}</td>
                        <td className="px-6 py-2.5 text-right font-semibold text-brand-lavanda whitespace-nowrap">{formatCurrency(p.valor_final * pr / 100)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

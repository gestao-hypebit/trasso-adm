'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import {
  Repeat, CalendarRange, Users, ArrowUpRight, ArrowDownRight, Download, Settings2,
  Clock, MessageCircle, Check, Info,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { formatCurrency, formatDate, cn, whatsappUrl } from '@/lib/utils'
import { hojeISO, baixarCSV } from '@/lib/financeiro'
import { calcularMrr, type LancamentoMrr } from '@/lib/mrr'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Categoria = { id: string; nome: string; recorrente: boolean }

// Usado só enquanto a migration 20261001000000_categorias_mrr.sql não foi aplicada.
const CATEGORIA_MENSALIDADE_RE = /mensal|assinatura|cat[aá]logo|recorr|saas|plano|retainer|fee/i

const mesLabel = (mesKey: string, fmt = 'MMM/yy') => {
  const l = format(parseISO(mesKey + '-01'), fmt, { locale: ptBR })
  return l.charAt(0).toUpperCase() + l.slice(1)
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl">
      <p className="text-brand-lavanda/60 mb-1">{label}</p>
      <p className="font-bold text-brand-lima">MRR: {formatCurrency(payload[0].value)}</p>
      <p className="text-brand-lavanda/50">{payload[0].payload.clientes} cliente(s)</p>
    </div>
  )
}

export default function MrrPage() {
  const pathname = usePathname()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoMrr[]>([])
  const [semMigration, setSemMigration] = useState(false)
  const [loading, setLoading] = useState(true)
  const [configAberta, setConfigAberta] = useState(false)
  const [salvandoCat, setSalvandoCat] = useState<string | null>(null)
  const hoje = hojeISO()

  const load = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    let cats: Categoria[]
    const res = await db.from('categorias_financeiras').select('id, nome, recorrente').eq('tipo', 'receita').order('nome')
    if (res.error) {
      // Coluna `recorrente` ainda não existe: cai no palpite pelo nome.
      const fallback = await db.from('categorias_financeiras').select('id, nome').eq('tipo', 'receita').order('nome')
      cats = ((fallback.data ?? []) as { id: string; nome: string }[]).map(c => ({ ...c, recorrente: CATEGORIA_MENSALIDADE_RE.test(c.nome) }))
      setSemMigration(true)
    } else {
      cats = res.data ?? []
      setSemMigration(false)
    }
    setCategorias(cats)

    const ids = cats.filter(c => c.recorrente).map(c => c.id)
    if (ids.length) {
      const { data } = await db.from('lancamentos')
        .select('valor, data, status, descricao, cliente_id, clientes(nome, whatsapp, telefone), categorias_financeiras(nome)')
        .eq('tipo', 'receita')
        .in('categoria_id', ids)
      setLancamentos(data ?? [])
    } else {
      setLancamentos([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function alternarCategoria(c: Categoria) {
    if (semMigration) return
    setSalvandoCat(c.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any).from('categorias_financeiras').update({ recorrente: !c.recorrente }).eq('id', c.id)
    if (!error) await load()
    setSalvandoCat(null)
  }

  const calc = useMemo(() => calcularMrr(lancamentos, hoje), [lancamentos, hoje])
  const marcadas = categorias.filter(c => c.recorrente)
  const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`
  const serieChart = calc.serie.map(s => ({ ...s, mes: mesLabel(s.mesKey) }))
  const nomeMesPassado = mesLabel(calc.serie[10].mesKey, 'MMMM')
  const nomeMesAtual = mesLabel(calc.serie[11].mesKey, 'MMMM')
  const valorAguardando = calc.aguardando.reduce((s, c) => s + c.valorMensal, 0)
  const maxCategoria = Math.max(...calc.porCategoria.map(([, v]) => v.valor), 1)
  const saldoMesPassado = calc.mesPassado.novoMrr - calc.mesPassado.churnMrr

  function exportar() {
    baixarCSV(
      `mrr-clientes-${hoje}.csv`,
      ['Cliente', 'Categoria', 'Valor mensal', 'Cliente desde', 'Meses pagos', 'Pago este mês'],
      calc.ativos.map(c => [c.nome, c.categoria, c.valorMensal, mesLabel(c.desde), String(c.mesesPagos), c.pagoEsteMes ? 'Sim' : 'Não']),
    )
  }

  const kpis = [
    { label: 'MRR', valor: formatCurrency(calc.mrr), sub: calc.crescimento12m === null ? 'Receita mensal recorrente' : `${calc.crescimento12m >= 0 ? '+' : ''}${pct(calc.crescimento12m)} em 12 meses`, icon: Repeat, cor: 'text-brand-lima', bg: 'bg-brand-lima/10' },
    { label: 'ARR (MRR × 12)', valor: formatCurrency(calc.arr), sub: 'Receita anual recorrente', icon: CalendarRange, cor: 'text-brand-lavanda', bg: 'bg-brand-violeta/10' },
    { label: 'Clientes ativos', valor: String(calc.ativos.length), sub: `Ticket médio ${formatCurrency(calc.arpa)}`, icon: Users, cor: 'text-brand-lavanda', bg: 'bg-brand-violeta/10' },
    { label: `Churn de ${nomeMesPassado.toLowerCase()}`, valor: pct(calc.mesPassado.taxaChurn), sub: `Média 6m ${pct(calc.churnMedio)}${calc.ltv ? ` · LTV ≈ ${formatCurrency(calc.ltv)}` : ''}`, icon: ArrowDownRight, cor: calc.mesPassado.taxaChurn > 0.05 ? 'text-brand-rosa' : 'text-brand-lavanda', bg: 'bg-brand-rosa/10' },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Receita recorrente" />
      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="MRR" description="Calculado pelas mensalidades lançadas no financeiro">
          <Button variant="outline" size="sm" onClick={exportar} disabled={!calc.ativos.length}><Download className="h-4 w-4" /> Exportar CSV</Button>
          <Button variant="outline" size="sm" onClick={() => setConfigAberta(v => !v)}><Settings2 className="h-4 w-4" /> Categorias</Button>
        </PageHeader>
        <FinanceiroSubNav pathname={pathname} />

        {semMigration && (
          <div className="flex items-start gap-3 mb-4 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-4 py-3 text-sm text-brand-lavanda/80">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-yellow-400" />
            <p>
              As categorias de mensalidade estão sendo escolhidas pelo nome. Para poder marcar e desmarcar à vontade,
              rode o arquivo <code className="text-yellow-400">supabase/migrations/20261001000000_categorias_mrr.sql</code> no SQL Editor do Supabase.
            </p>
          </div>
        )}

        {(configAberta || (!loading && marcadas.length === 0)) && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quais categorias são mensalidade?</CardTitle>
              <p className="text-xs text-brand-lavanda/40">Só os lançamentos de receita dessas categorias entram no MRR. O resto (projetos, avulsos) fica de fora.</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {categorias.length === 0 && <p className="text-xs text-brand-lavanda/40">Nenhuma categoria de receita cadastrada.</p>}
              {categorias.map(c => (
                <button
                  key={c.id}
                  type="button"
                  disabled={semMigration || salvandoCat === c.id}
                  onClick={() => alternarCategoria(c)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed',
                    c.recorrente ? 'border-brand-lima/40 bg-brand-lima/10 text-brand-lima' : 'border-white/[0.1] text-brand-lavanda/50 hover:text-brand-lavanda hover:border-white/[0.2]',
                    salvandoCat === c.id && 'opacity-50'
                  )}
                >
                  {c.recorrente && <Check className="h-3 w-3" />}
                  {c.nome}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

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
            <CardHeader className="pb-3"><CardTitle className="text-base">Evolução do MRR (12 meses)</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[220px] flex items-center justify-center text-brand-lavanda/30 text-sm">Carregando...</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={serieChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
            <CardHeader className="pb-3"><CardTitle className="text-base">Movimento de {nomeMesPassado.toLowerCase()}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-brand-lavanda/70"><ArrowUpRight className="h-4 w-4 text-brand-lima" /> Novos ({calc.mesPassado.novos})</span>
                <span className="font-semibold text-brand-lima">+{formatCurrency(calc.mesPassado.novoMrr)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-brand-lavanda/70"><ArrowDownRight className="h-4 w-4 text-brand-rosa" /> Saíram ({calc.mesPassado.churn})</span>
                <span className="font-semibold text-brand-rosa">-{formatCurrency(calc.mesPassado.churnMrr)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                <span className="text-brand-lavanda/70">Saldo de MRR</span>
                <span className={cn('font-bold', saldoMesPassado >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>
                  {saldoMesPassado >= 0 ? '+' : ''}{formatCurrency(saldoMesPassado)}
                </span>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 text-xs flex justify-between">
                <span className="text-brand-lavanda/50">Novos em {nomeMesAtual.toLowerCase()} ({calc.mesAtual.novos})</span>
                <span className="text-brand-lima font-medium">+{formatCurrency(calc.mesAtual.novoMrr)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-yellow-400" /> Ainda não pagaram este mês</CardTitle>
                <span className="text-xs font-semibold text-yellow-400 whitespace-nowrap">{formatCurrency(valorAguardando)}</span>
              </div>
              <p className="text-xs text-brand-lavanda/40">Clientes ativos sem mensalidade recebida em {nomeMesAtual.toLowerCase()}.</p>
            </CardHeader>
            <CardContent className="p-0 max-h-80 overflow-y-auto">
              {calc.aguardando.length === 0 ? (
                <p className="text-xs text-brand-lavanda/40 py-8 text-center">{loading ? 'Carregando...' : 'Todo mundo já pagou este mês. 🎉'}</p>
              ) : calc.aguardando.map(c => {
                const zap = whatsappUrl(c.whatsapp, `Olá! Tudo bem? Passando para lembrar da mensalidade de ${formatCurrency(c.valorMensal)} deste mês. Qualquer dúvida, estou à disposição!`)
                return (
                  <div key={c.chave} className="flex items-center gap-3 px-6 py-2.5 border-b border-white/[0.04] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-brand-lavanda truncate">{c.nome}</p>
                      <p className="text-[11px] text-brand-lavanda/40">Último lançamento {formatDate(c.ultimoLancamento)}</p>
                    </div>
                    <span className="text-sm font-medium text-brand-lavanda whitespace-nowrap">{formatCurrency(c.valorMensal)}</span>
                    {zap && (
                      <a href={zap} target="_blank" rel="noopener noreferrer" title="Cobrar pelo WhatsApp"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-brand-lavanda/30 hover:text-brand-lima hover:bg-brand-lima/10 transition-colors">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">MRR por categoria</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {calc.porCategoria.length === 0 ? (
                <p className="text-xs text-brand-lavanda/40 py-6 text-center">{loading ? 'Carregando...' : 'Nenhuma mensalidade lançada nos últimos 2 meses.'}</p>
              ) : calc.porCategoria.map(([nome, v]) => (
                <div key={nome} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-brand-lavanda/80 truncate">{nome} <span className="text-xs text-brand-lavanda/40">· {v.qtd} cliente(s)</span></span>
                    <span className="font-medium text-brand-lavanda whitespace-nowrap">{formatCurrency(v.valor)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full bg-brand-lima" style={{ width: `${(v.valor / maxCategoria) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Clientes ativos ({calc.ativos.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Cliente</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-3 py-3">Categoria</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-3 py-3">Cliente desde</th>
                    <th className="text-center text-xs text-brand-lavanda/50 font-medium px-3 py-3">Meses</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Mensal</th>
                    <th className="text-center text-xs text-brand-lavanda/50 font-medium px-6 py-3">Este mês</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                  ) : calc.ativos.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Nenhum cliente com mensalidade lançada neste mês ou no anterior.</td></tr>
                  ) : calc.ativos.map(c => (
                    <tr key={c.chave} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3 text-brand-lavanda font-medium whitespace-nowrap">{c.nome}</td>
                      <td className="px-3 py-3 text-xs text-brand-lavanda/60 whitespace-nowrap">{c.categoria}</td>
                      <td className="px-3 py-3 text-xs text-brand-lavanda/60 whitespace-nowrap">{mesLabel(c.desde)}</td>
                      <td className="px-3 py-3 text-xs text-center text-brand-lavanda/60">{c.mesesPagos}</td>
                      <td className="px-3 py-3 text-right font-semibold text-brand-lima whitespace-nowrap">{formatCurrency(c.valorMensal)}</td>
                      <td className="px-6 py-3 text-center">
                        {c.pagoEsteMes ? <Badge variant="concluido">Pago</Badge> : <Badge variant="pendente">Aguardando</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-brand-lavanda/30 mt-3">
          Cliente ativo = tem mensalidade lançada neste mês ou no anterior. Churn = pagou num mês e não teve lançamento no seguinte.
          Lançamentos sem cliente vinculado são agrupados pela descrição (ignorando mês e números), então vincule o cliente sempre que puder.
        </p>
      </main>
    </div>
  )
}

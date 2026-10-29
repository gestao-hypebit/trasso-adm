'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Megaphone, Wallet, Users, CalendarCheck, Trophy, Flame, Timer, TrendingUp } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { diaSP } from '@/lib/anuncios/regras'
import { taxa, type Historico } from '@/lib/leads/funil'
import { labelFrenteLead, type FrenteLead } from '@/lib/leads/frente'
import {
  CATEGORIA_TRAFEGO, custoPor, ehTrafegoPago, horasAtePrimeiroContato, mediana, resumoCampanhas, temperaturaConfig,
  type LeadTrafego,
} from '@/lib/leads/trafego'

// Painel de tráfego pago em /leads/conversao. Enquanto a integração com a Meta
// está parada, o investimento vem das despesas pagas em categorias de tráfego
// (lançadas à mão no financeiro), separadas pela frente do lançamento.
// Os leads de cada campanha vêm do utm_campaign (ou da campanha escolhida no cadastro).

type Despesa = { valor: number; data: string; frente: string | null; categorias_financeiras: { nome: string } | null }

const fmtCusto = (v: number | null) => (v === null ? '—' : formatCurrency(v))
const fmtHoras = (h: number | null) =>
  h === null ? '—' : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0).replace('.', ',')} h` : `${Math.round(h / 24)} dias`

export function PainelTrafego({ leads, historico, periodo, frente }: {
  leads: LeadTrafego[]
  historico: Historico[]
  periodo: number
  frente: FrenteLead | 'todas'
}) {
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await (createClient() as any)
        .from('lancamentos')
        .select('valor, data, frente, categorias_financeiras(nome)')
        .eq('tipo', 'despesa')
        .in('status', ['pago', 'recebido'])
      if (error) throw new Error(error.message)
      setDespesas(((data ?? []) as Despesa[]).filter((d) => CATEGORIA_TRAFEGO.test(d.categorias_financeiras?.nome ?? '')))
    }
    load().catch((e) => {
      console.error('[leads] painel de tráfego', e)
      setAviso(`Não foi possível ler o investimento: ${e instanceof Error ? e.message : e}`)
    })
  }, [])

  const r = useMemo(() => {
    const corte = periodo ? Date.now() - periodo * 86_400_000 : 0
    const diaCorte = periodo ? diaSP(new Date(corte)) : ''
    const pagos = leads.filter((l) => ehTrafegoPago(l) && new Date(l.created_at).getTime() >= corte)
    const ids = new Set(pagos.map((l) => l.id))
    const hist = historico.filter((h) => ids.has(h.lead_id))
    const horas = pagos.map((l) => horasAtePrimeiroContato(l, hist)).filter((h): h is number => h !== null)

    const noPeriodo = despesas.filter((d) => !diaCorte || d.data >= diaCorte)
    // Com um negócio escolhido, só conta a despesa lançada nele; "Geral" fica de fora e aparece no aviso.
    const investimento = noPeriodo
      .filter((d) => frente === 'todas' || d.frente === frente)
      .reduce((s, d) => s + Number(d.valor), 0)
    const semNegocio = frente === 'todas' ? 0 : noPeriodo.filter((d) => d.frente === 'geral').reduce((s, d) => s + Number(d.valor), 0)

    const resumo = resumoCampanhas(pagos, hist, [], [])
    return {
      ...resumo,
      total: { ...resumo.total, gasto: investimento },
      semNegocio,
      primeiroContato: mediana(horas),
      amostraContato: horas.length,
    }
  }, [leads, historico, despesas, periodo, frente])

  const t = r.total
  const semDados = t.leads === 0 && t.gasto === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4 text-brand-lima" /> Tráfego pago</CardTitle>
        <p className="text-xs text-brand-lavanda/50">
          {frente === 'todas' ? 'Todos os negócios' : labelFrenteLead(frente)}: investimento lançado em{' '}
          <Link href="/financeiro/despesas" className="text-brand-lima">Contas a Pagar</Link> (categoria de tráfego/anúncios, já paga)
          e os leads de tráfego pago que chegaram no período.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {aviso && <p className="text-sm text-brand-rosa">{aviso}</p>}
        {r.semNegocio > 0 && (
          <p className="text-xs text-brand-lavanda/50 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            {formatCurrency(r.semNegocio)} em tráfego estão lançados como <span className="text-brand-lavanda">Geral</span> e não entram aqui.
            Para separar, edite a despesa e escolha a frente {labelFrenteLead(frente)}.
          </p>
        )}

        {semDados ? (
          <p className="text-sm text-brand-lavanda/40">Nenhum lead de tráfego pago nem investimento lançado no período.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Investimento" value={formatCurrency(t.gasto)} icon={Wallet} />
              <KpiCard title="Leads" value={String(t.leads)} icon={Users} sub={`Custo por lead: ${fmtCusto(custoPor(t.gasto, t.leads))}`} />
              <KpiCard
                title="Reuniões"
                value={String(t.reunioes)}
                icon={CalendarCheck}
                sub={`${taxa(t.reunioes, t.leads)}% dos leads · ${fmtCusto(custoPor(t.gasto, t.reunioes))} cada`}
              />
              <KpiCard
                title="Vendas"
                value={String(t.vendas)}
                icon={Trophy}
                iconColor="text-brand-lima"
                sub={`${fmtCusto(custoPor(t.gasto, t.vendas))} por venda`}
              />
              <KpiCard title="Leads quentes" value={`${taxa(t.quentes, t.leads)}%`} icon={Flame} iconColor="text-brand-rosa" sub={`${t.quentes} de ${t.leads}`} />
              <KpiCard title="Receita fechada" value={formatCurrency(t.receita)} icon={TrendingUp} />
              <KpiCard
                title="Retorno sobre o gasto"
                value={t.gasto > 0 ? `${(t.receita / t.gasto).toFixed(1).replace('.', ',')}x` : '—'}
                icon={TrendingUp}
                iconColor="text-brand-lima"
                sub="Receita fechada ÷ investimento"
              />
              <KpiCard
                title="Tempo até o 1º contato"
                value={fmtHoras(r.primeiroContato)}
                icon={Timer}
                sub={r.amostraContato ? `Mediana de ${r.amostraContato} lead${r.amostraContato === 1 ? '' : 's'}` : 'Sai de "Novo" ao chamar no WhatsApp'}
              />
            </div>

            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Campanha</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Leads</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Quentes</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Reuniões</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Vendas</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-6 py-3">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {r.campanhas.map((c) => (
                    <tr key={c.chave} className="border-b border-white/[0.04]">
                      <td className="px-6 py-3 text-brand-lavanda max-w-[280px] truncate" title={c.nome}>{c.nome}</td>
                      <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.leads}</td>
                      <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.leads ? `${taxa(c.quentes, c.leads)}%` : '—'}</td>
                      <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.reunioes}</td>
                      <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.vendas}</td>
                      <td className="px-6 py-3 text-right text-brand-lima">{formatCurrency(c.receita)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Se "quente" não fecha mais que "frio", a pontuação do formulário precisa de ajuste. */}
            <div>
              <p className="text-sm font-semibold text-brand-lavanda">A pontuação do formulário acerta?</p>
              <p className="text-xs text-brand-lavanda/50 mb-3">Leads quentes deveriam virar reunião e venda mais do que os mornos e frios.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {r.temperaturas.filter((x) => x.leads > 0).map((x) => (
                  <div key={x.temperatura} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-sm font-medium text-brand-lavanda">
                      {x.temperatura === 'sem' ? 'Sem classificação' : `${temperaturaConfig[x.temperatura].emoji} ${temperaturaConfig[x.temperatura].label}`}
                      <span className="ml-1.5 text-xs text-brand-lavanda/40">{x.leads} lead{x.leads === 1 ? '' : 's'}</span>
                    </p>
                    <p className="mt-1 text-xs text-brand-lavanda/60">
                      {taxa(x.reunioes, x.leads)}% viram reunião · <span className="text-brand-lima">{taxa(x.vendas, x.leads)}% fecham</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

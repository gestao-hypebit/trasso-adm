'use client'

import { useEffect, useMemo, useState } from 'react'
import { Inbox, Target, FileText, Clock } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { LeadsSubNav } from '@/components/leads/leads-sub-nav'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import { ETAPAS_FUNIL, etapaLabel, resumoFunil, taxa, type Historico, type LeadFunil } from '@/lib/leads/funil'

const periodos = [
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
  { dias: 365, label: '12 meses' },
  { dias: 0, label: 'Tudo' },
]

const fmtDias = (d: number | null) => (d === null ? '—' : d < 1 ? '< 1 dia' : `${d.toFixed(d < 10 ? 1 : 0).replace('.', ',')} dias`)

export default function ConversaoPage() {
  const [leads, setLeads] = useState<LeadFunil[]>([])
  const [historico, setHistorico] = useState<Historico[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState(90)

  useEffect(() => {
    async function load() {
      const supabase = createClient() as any
      const [{ data: l, error }, { data: h }] = await Promise.all([
        supabase.from('leads').select('id, status, origem, utm, valor_estimado, motivo_perda, created_at, formularios(nome)'),
        supabase.from('lead_historico').select('lead_id, de, para, created_at'),
      ])
      if (error) setErro('Não foi possível carregar. A migration do funil já foi aplicada no Supabase?')
      setLeads((l as LeadFunil[]) ?? [])
      setHistorico((h as Historico[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // O período filtra pela data em que o lead chegou (coorte), não pela data do fechamento.
  const r = useMemo(() => {
    const corte = periodo ? Date.now() - periodo * 86_400_000 : 0
    const noPeriodo = leads.filter((l) => new Date(l.created_at).getTime() >= corte)
    const ids = new Set(noPeriodo.map((l) => l.id))
    return resumoFunil(noPeriodo, historico.filter((h) => ids.has(h.lead_id)))
  }, [leads, historico, periodo])

  const t = r.total
  const iFechado = ETAPAS_FUNIL.indexOf('convertido')
  const iProposta = ETAPAS_FUNIL.indexOf('proposta')
  const maxMotivo = Math.max(1, ...r.motivos.map((m) => m.qtd))

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Leads" description="Conversão do funil" />

      <main className="flex-1 p-4 md:p-6">
        <LeadsSubNav />
        <PageHeader title="Conversão" description="Leads que chegaram no período e até onde cada um avançou.">
          <div className="flex rounded-lg border border-white/[0.1] p-0.5">
            {periodos.map((p) => (
              <button
                key={p.dias}
                onClick={() => setPeriodo(p.dias)}
                className={cn('rounded-md px-2.5 py-1.5 text-xs', periodo === p.dias ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50')}
              >{p.label}</button>
            ))}
          </div>
        </PageHeader>

        {erro && <p className="mb-4 text-sm text-brand-rosa">{erro}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Leads" value={String(t.leads)} icon={Inbox} />
              <KpiCard title="Taxa de fechamento" value={`${taxa(t.porEtapa[iFechado], t.leads)}%`} icon={Target} iconColor="text-brand-lima" />
              <KpiCard title="Propostas que fecham" value={`${taxa(t.porEtapa[iFechado], t.porEtapa[iProposta])}%`} icon={FileText} />
              <KpiCard title="Ciclo médio de venda" value={fmtDias(r.cicloMedioDias)} icon={Clock} />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Funil</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {ETAPAS_FUNIL.map((etapa, i) => {
                  const qtd = t.porEtapa[i]
                  const largura = t.leads ? Math.max(2, (qtd / t.leads) * 100) : 0
                  return (
                    <div key={etapa} className="grid grid-cols-[150px_1fr_90px] items-center gap-3 text-sm">
                      <span className="text-brand-lavanda/70 truncate">{etapaLabel(etapa)}</span>
                      <div className="h-7 rounded-md bg-white/[0.04] overflow-hidden">
                        <div
                          className={cn('h-full rounded-md flex items-center px-2 text-xs font-semibold', i === iFechado ? 'bg-brand-lima text-brand-noite' : 'bg-brand-violeta/70 text-brand-lavanda')}
                          style={{ width: `${largura}%` }}
                        >{qtd}</div>
                      </div>
                      <span className="text-right text-xs text-brand-lavanda/50">
                        {i === 0 ? '100%' : `${taxa(qtd, t.porEtapa[i - 1])}% da etapa anterior`}
                      </span>
                    </div>
                  )
                })}
                <p className="text-[11px] text-brand-lavanda/40 pt-1">
                  Cada lead conta em todas as etapas que chegou a atingir, mesmo se depois foi perdido. {t.perdidos} perdido{t.perdidos === 1 ? '' : 's'} no período.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Por origem</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Origem</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Leads</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Reunião</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Proposta</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Fechados</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Conversão</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-6 py-3">Valor fechado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.canais.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-10 text-center text-brand-lavanda/40 text-sm">Nenhum lead no período.</td></tr>
                      ) : [...r.canais, t].map((c) => (
                        <tr key={c.canal} className={cn('border-b border-white/[0.04]', c === t && 'font-semibold bg-white/[0.02]')}>
                          <td className="px-6 py-3 text-brand-lavanda">{c.canal}</td>
                          <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.leads}</td>
                          <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.porEtapa[ETAPAS_FUNIL.indexOf('qualificado')]}</td>
                          <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.porEtapa[iProposta]}</td>
                          <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.porEtapa[iFechado]}</td>
                          <td className="px-4 py-3 text-right text-brand-lima">{taxa(c.porEtapa[iFechado], c.leads)}%</td>
                          <td className="px-6 py-3 text-right text-brand-lavanda/70">{formatCurrency(c.valorFechado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Tempo médio em cada etapa</CardTitle></CardHeader>
                <CardContent className="space-y-2.5">
                  {r.diasPorEtapa.map((d) => (
                    <div key={d.etapa} className="flex items-center justify-between text-sm">
                      <span className="text-brand-lavanda/70">{etapaLabel(d.etapa)}</span>
                      <span className="text-brand-lavanda">
                        {fmtDias(d.dias)}
                        {d.amostra > 0 && <span className="ml-2 text-[11px] text-brand-lavanda/40">({d.amostra} lead{d.amostra === 1 ? '' : 's'})</span>}
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-brand-lavanda/40 pt-1">Conta só leads que já saíram da etapa. O histórico começa a partir da atualização do funil.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Motivos de perda</CardTitle></CardHeader>
                <CardContent className="space-y-2.5">
                  {r.motivos.length === 0 ? (
                    <p className="text-sm text-brand-lavanda/40">Nenhum lead perdido no período.</p>
                  ) : r.motivos.map((m) => (
                    <div key={m.motivo} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-lavanda/70">{m.motivo}</span>
                        <span className="text-brand-lavanda">{m.qtd}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.04]">
                        <div className="h-full rounded-full bg-brand-rosa/70" style={{ width: `${(m.qtd / maxMotivo) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

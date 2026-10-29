'use client'

import { useEffect, useMemo, useState } from 'react'
import { Megaphone, Wallet, Users, CalendarCheck, Trophy, Flame, Timer, TrendingUp } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import { buscarTudo } from '@/lib/anuncios/consulta'
import { diaSP } from '@/lib/anuncios/regras'
import { taxa, type Historico } from '@/lib/leads/funil'
import {
  custoPor, ehTrafegoPago, horasAtePrimeiroContato, mediana, resumoCampanhas, temperaturaConfig,
  type Campanha, type GastoCampanha, type LeadTrafego,
} from '@/lib/leads/trafego'

// Painel de tráfego pago em /leads/conversao: gasto das campanhas da marca Slick
// (módulo de anúncios) cruzado com os leads que cada campanha trouxe (utm_campaign).

type Metrica = { campaign_id: string; data: string; spend: number }

const fmtCusto = (v: number | null) => (v === null ? '—' : formatCurrency(v))
const fmtHoras = (h: number | null) =>
  h === null ? '—' : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0).replace('.', ',')} h` : `${Math.round(h / 24)} dias`

export function PainelTrafego({ leads, historico, periodo }: { leads: LeadTrafego[]; historico: Historico[]; periodo: number }) {
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient() as any
      // anuncio_marcas tem permissão por coluna: lê só as liberadas e filtra aqui (como em /anuncios).
      const { data: marcas, error } = await supabase.from('anuncio_marcas').select('id, slug')
      if (error) throw new Error(error.message)
      const marca = (marcas ?? []).find((m: { slug: string }) => m.slug === 'slick')
      if (!marca) {
        setAviso('A marca "Slick" não existe no módulo de anúncios: o gasto não aparece aqui.')
        return
      }
      const { data: vinculos } = await supabase.from('anuncio_campanha_marca').select('campaign_id').eq('marca_id', marca.id)
      const ids = (vinculos ?? []).map((v: { campaign_id: string }) => v.campaign_id)
      if (ids.length === 0) return
      const [{ data: c }, m] = await Promise.all([
        supabase.from('anuncio_campanhas').select('campaign_id, nome').in('campaign_id', ids),
        buscarTudo<Metrica>((de, ate) =>
          supabase.from('anuncio_metricas_diarias').select('campaign_id, data, spend').in('campaign_id', ids).order('data').range(de, ate),
        ),
      ])
      setCampanhas((c as Campanha[]) ?? [])
      setMetricas(m)
    }
    load().catch((e) => {
      console.error('[leads] painel de tráfego', e)
      setAviso(`Não foi possível ler o gasto das campanhas: ${e instanceof Error ? e.message : e}`)
    })
  }, [])

  const r = useMemo(() => {
    const corte = periodo ? Date.now() - periodo * 86_400_000 : 0
    const diaCorte = periodo ? diaSP(new Date(corte)) : ''
    const pagos = leads.filter((l) => ehTrafegoPago(l) && new Date(l.created_at).getTime() >= corte)
    const ids = new Set(pagos.map((l) => l.id))
    const hist = historico.filter((h) => ids.has(h.lead_id))
    const gastos: GastoCampanha[] = metricas.filter((m) => !diaCorte || m.data >= diaCorte)
    const horas = pagos.map((l) => horasAtePrimeiroContato(l, hist)).filter((h): h is number => h !== null)
    return { ...resumoCampanhas(pagos, hist, campanhas, gastos), primeiroContato: mediana(horas), amostraContato: horas.length }
  }, [leads, historico, campanhas, metricas, periodo])

  const t = r.total
  const semDados = t.leads === 0 && t.gasto === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4 text-brand-lima" /> Tráfego pago</CardTitle>
        <p className="text-xs text-brand-lavanda/50">
          Gasto das campanhas da marca Slick (nome começando com SLICK ou TRASSO no módulo de anúncios) e os leads que cada uma trouxe.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {aviso && <p className="text-sm text-brand-rosa">{aviso}</p>}

        {semDados ? (
          <p className="text-sm text-brand-lavanda/40">Nenhum lead de tráfego pago nem gasto de campanha no período.</p>
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
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Gasto</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Leads</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Custo/lead</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Quentes</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Reuniões</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Vendas</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-6 py-3">Custo/venda</th>
                  </tr>
                </thead>
                <tbody>
                  {r.campanhas.map((c) => (
                    <tr key={c.chave} className="border-b border-white/[0.04]">
                      <td className="px-6 py-3 text-brand-lavanda max-w-[280px] truncate" title={c.nome}>{c.nome}</td>
                      <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.gasto === null ? '—' : formatCurrency(c.gasto)}</td>
                      <td className={cn('px-4 py-3 text-right', c.leads === 0 && (c.gasto ?? 0) > 0 ? 'text-brand-rosa' : 'text-brand-lavanda/70')}>{c.leads}</td>
                      <td className="px-4 py-3 text-right text-brand-lavanda/70">{fmtCusto(custoPor(c.gasto ?? 0, c.leads))}</td>
                      <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.leads ? `${taxa(c.quentes, c.leads)}%` : '—'}</td>
                      <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.reunioes}</td>
                      <td className="px-4 py-3 text-right text-brand-lavanda/70">{c.vendas}</td>
                      <td className="px-6 py-3 text-right text-brand-lima">{fmtCusto(custoPor(c.gasto ?? 0, c.vendas))}</td>
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

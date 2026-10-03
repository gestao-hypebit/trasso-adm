'use client'

import { Repeat, CalendarRange, Users, Receipt, AlertTriangle, ArrowUpRight, ArrowDownRight, ChevronRight, Loader2 } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LINHA_CORES } from '@/lib/financeiro/linhas'
import { nomeLinha, type LinhaRec, type ResultadoLinha } from '@/lib/recorrencia'
import { cn, formatCurrency } from '@/lib/utils'
import type { Recorrencia } from '@/components/recorrencia/use-recorrencia'

const mesLabel = (mesKey: string, fmt = 'MMM/yy') => {
  const l = format(parseISO(mesKey + '-01'), fmt, { locale: ptBR })
  return l.charAt(0).toUpperCase() + l.slice(1)
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`

function TooltipSerie({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((t: number, p: any) => t + (p.value ?? 0), 0)
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl">
      <p className="mb-1 text-brand-lavanda/60">{label}</p>
      {[...payload].reverse().map((p: any) => (
        <p key={p.dataKey} style={{ color: p.stroke }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
      <p className="mt-1 border-t border-white/[0.08] pt-1 font-semibold text-brand-lavanda">Agência: {formatCurrency(total)}</p>
    </div>
  )
}

export function VisaoGeral({ r, onAbrir }: { r: Recorrencia; onAbrir: (linha: LinhaRec) => void }) {
  const linhas: ResultadoLinha[] = [r.catalogo, r.servicos]
  const bruto = r.catalogo.mrrBruto + r.servicos.mrrBruto
  const liquido = r.catalogo.mrr.mrr + r.servicos.mrr.mrr
  const ativas = r.catalogo.ativas + r.servicos.ativas
  const assinaturas = r.catalogo.totalAssinaturas + r.servicos.totalAssinaturas
  const inadimplentes = r.catalogo.inadimplentes + r.servicos.inadimplentes
  const atraso = r.catalogo.totalAtraso + r.servicos.totalAtraso

  // Histórico pelos lançamentos (líquido): é o que existe mês a mês.
  const serie = r.catalogo.mrr.serie.map((s, i) => ({
    mes: mesLabel(s.mesKey),
    catalogo: s.mrr,
    servicos: r.servicos.mrr.serie[i]?.mrr ?? 0,
  }))
  const nomeMesPassado = mesLabel(r.catalogo.mrr.serie[10].mesKey, 'MMMM').toLowerCase()

  return (
    <div className="space-y-6">
      {r.semCliente.qtd > 0 && (
        <button
          type="button"
          onClick={() => onAbrir('catalogo_place')}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-4 py-2.5 text-left text-sm text-brand-lavanda/80 transition-colors hover:bg-yellow-400/[0.08]"
        >
          <span>
            <AlertTriangle className="mr-1.5 inline h-4 w-4 text-yellow-400" />
            {r.semCliente.qtd} assinatura(s) ativa(s) no Asaas ({formatCurrency(r.semCliente.valor)}/mês) não estão ligadas a nenhum cliente e não entram no MRR.
          </span>
          <span className="shrink-0 text-xs text-yellow-400">Ligar →</span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="MRR da agência"
          value={formatCurrency(bruto)}
          icon={Repeat}
          iconColor="text-brand-lima"
          sub={r.asaasCarregando
            ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> buscando no Asaas…</span>
            : <>Bruto · líquido <span className="text-brand-lavanda/70">{formatCurrency(liquido)}</span></>}
        />
        <KpiCard title="ARR (MRR × 12)" value={formatCurrency(bruto * 12)} icon={CalendarRange} sub="Receita recorrente anual" />
        <KpiCard
          title="Assinaturas"
          value={String(assinaturas)}
          icon={Users}
          sub={<>
            <span className="text-brand-lima/80">{assinaturas - inadimplentes} em dia</span>
            {' · '}
            <span className={inadimplentes > 0 ? 'text-brand-rosa' : undefined}>{inadimplentes} inadimplente{inadimplentes === 1 ? '' : 's'}</span>
          </>}
        />
        <KpiCard
          title="Ticket médio"
          value={formatCurrency(ativas ? bruto / ativas : 0)}
          icon={Receipt}
          sub={atraso > 0 ? <span className="text-brand-rosa/80">{formatCurrency(atraso)} em atraso</span> : 'Ninguém em atraso'}
        />
      </div>

      {/* Por linha */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">MRR por linha</CardTitle>
          {bruto > 0 && (
            <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/[0.04]">
              {linhas.map((l) => (
                <div key={l.linha} style={{ width: `${(l.mrrBruto / bruto) * 100}%`, background: LINHA_CORES[l.linha] }} />
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-6 py-2.5 text-left text-xs font-medium text-brand-lavanda/50">Linha</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-brand-lavanda/50">Ativas</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-brand-lavanda/50">MRR bruto</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-brand-lavanda/50">Líquido</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-brand-lavanda/50">Inadimplência</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.linha} onClick={() => onAbrir(l.linha)} className="group cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]">
                    <td className="px-6 py-3">
                      <span className="flex items-center gap-2 font-medium text-brand-lavanda group-hover:text-brand-lima">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LINHA_CORES[l.linha] }} />
                        {nomeLinha[l.linha]}
                        {bruto > 0 && <span className="text-xs font-normal text-brand-lavanda/40">{pct(l.mrrBruto / bruto)}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-brand-lavanda/70">{l.ativas}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-lavanda">{formatCurrency(l.mrrBruto)}</td>
                    <td className="px-4 py-3 text-right text-brand-lavanda/60">{formatCurrency(l.mrr.mrr)}</td>
                    <td className={cn('px-4 py-3 text-right', l.totalAtraso > 0 ? 'text-brand-rosa' : 'text-brand-lavanda/30')}>
                      {l.totalAtraso > 0 ? <>{formatCurrency(l.totalAtraso)} <span className="text-[11px]">({l.inadimplentes})</span></> : '—'}
                    </td>
                    <td className="pr-4"><ChevronRight className="h-4 w-4 text-brand-lavanda/20 group-hover:text-brand-lavanda/60" /></td>
                  </tr>
                ))}
                <tr className="bg-white/[0.02] font-semibold">
                  <td className="px-6 py-3 text-brand-lavanda">Agência (total)</td>
                  <td className="px-4 py-3 text-right text-brand-lavanda">{ativas}</td>
                  <td className="px-4 py-3 text-right text-brand-lima">{formatCurrency(bruto)}</td>
                  <td className="px-4 py-3 text-right text-brand-lavanda/70">{formatCurrency(liquido)}</td>
                  <td className={cn('px-4 py-3 text-right', atraso > 0 ? 'text-brand-rosa' : 'text-brand-lavanda/30')}>{atraso > 0 ? formatCurrency(atraso) : '—'}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Evolução (12 meses)</CardTitle>
            <p className="text-xs text-brand-lavanda/40">Pelas mensalidades lançadas no financeiro (valor líquido), empilhado por linha.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={serie} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.15)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                <Tooltip content={<TooltipSerie />} />
                <Area dataKey="servicos" name="Serviços" stackId="mrr" type="monotone" stroke={LINHA_CORES.agencia} fill={LINHA_CORES.agencia} fillOpacity={0.25} strokeWidth={2} />
                <Area dataKey="catalogo" name="Catálogo Place" stackId="mrr" type="monotone" stroke={LINHA_CORES.catalogo_place} fill={LINHA_CORES.catalogo_place} fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-2 flex justify-end gap-4">
              {(['agencia', 'catalogo_place'] as const).map((l) => (
                <span key={l} className="flex items-center gap-1.5 text-[11px] text-brand-lavanda/50">
                  <span className="h-2 w-2 rounded-sm" style={{ background: LINHA_CORES[l] }} /> {nomeLinha[l]}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Movimento de {nomeMesPassado}</CardTitle>
            <p className="text-xs text-brand-lavanda/40">Quem começou e quem parou de pagar, pelos lançamentos.</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {linhas.map((l) => {
              const m = l.mrr.mesPassado
              const saldo = m.novoMrr - m.churnMrr
              return (
                <div key={l.linha} className="space-y-1.5">
                  <p className="flex items-center gap-2 text-xs font-medium text-brand-lavanda/60">
                    <span className="h-2 w-2 rounded-sm" style={{ background: LINHA_CORES[l.linha] }} /> {nomeLinha[l.linha]}
                  </p>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5 text-brand-lavanda/70"><ArrowUpRight className="h-3.5 w-3.5 text-brand-lima" /> Novos ({m.novos})</span>
                    <span className="text-brand-lima">+{formatCurrency(m.novoMrr)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5 text-brand-lavanda/70"><ArrowDownRight className="h-3.5 w-3.5 text-brand-rosa" /> Saíram ({m.churn})</span>
                    <span className="text-brand-rosa">-{formatCurrency(m.churnMrr)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.06] pt-1.5 text-xs">
                    <span className="text-brand-lavanda/50">Saldo</span>
                    <span className={cn('font-semibold', saldo >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>{saldo >= 0 ? '+' : ''}{formatCurrency(saldo)}</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-brand-lavanda/30">
        MRR bruto = assinaturas ativas no Asaas pelo valor cobrado (planos não mensais convertidos para mensal); cliente fora do Asaas entra pelo valor lançado.
        Líquido, evolução e movimento vêm das mensalidades lançadas no financeiro (já sem as taxas do Asaas).
        Uma assinatura é do Catálogo quando o cliente é só do Catálogo, quando as faturas dela estão ligadas a lançamentos do Catálogo ou quando a descrição fala em &quot;Catálogo&quot;; as demais são de Serviços.
      </p>
    </div>
  )
}

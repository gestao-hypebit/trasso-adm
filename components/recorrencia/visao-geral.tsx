'use client'

import Link from 'next/link'
import { Repeat, CalendarRange, Users, Receipt, AlertTriangle, ArrowUpRight, ArrowDownRight, ChevronRight, Loader2, UserMinus, Percent } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LINHA_CORES } from '@/lib/financeiro/linhas'
import { DIAS_CHURN_RECENTE, nomeLinha, type LinhaRec, type ResultadoLinha } from '@/lib/recorrencia'
import { diasEntre } from '@/lib/financeiro'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { Recorrencia } from '@/components/recorrencia/use-recorrencia'
import { ParaCobrar } from '@/components/recorrencia/para-cobrar'

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

export function VisaoGeral({ r, onAbrir, focoCobranca }: { r: Recorrencia; onAbrir: (linha: LinhaRec) => void; focoCobranca?: boolean }) {
  const linhas: ResultadoLinha[] = r.linhas
  const { mrrBruto: bruto, mrrLiquido: liquido, ativas, emDia, assinaturas, inadimplentes, atraso } = r.total

  // Histórico pelos lançamentos (líquido): é o que existe mês a mês.
  const base = linhas[0].mrr.serie
  const serie = base.map((s, i) => ({
    mes: mesLabel(s.mesKey),
    ...Object.fromEntries(linhas.map((l) => [l.linha, l.mrr.serie[i]?.mrr ?? 0])),
  }))
  const nomeMesPassado = mesLabel(base[10].mesKey, 'MMMM').toLowerCase()
  // Enquanto o Asaas não responde, os números saem só do financeiro e ainda vão mudar.
  const carregando = r.asaasCarregando ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-brand-lavanda/30" /> : null
  // Serviços embaixo na pilha; os SaaS por cima.
  const naPilha = [...linhas].reverse()
  // Leva para a primeira linha com assinatura sem cliente ligado.
  const linhaSemCliente = linhas.find((l) => l.contagem.so_asaas > 0)?.linha ?? 'catalogo_place'
  // Cancelamentos com último pagamento nos últimos 30 dias: viram aviso no topo.
  const recentes = r.churn.cancelamentos.filter((c) => c.ultimoPagamento && diasEntre(c.ultimoPagamento, r.hoje) <= 30)

  return (
    <div className="space-y-6">
      {r.semCliente.qtd > 0 && (
        <button
          type="button"
          onClick={() => onAbrir(linhaSemCliente)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-4 py-2.5 text-left text-sm text-brand-lavanda/80 transition-colors hover:bg-yellow-400/[0.08]"
        >
          <span>
            <AlertTriangle className="mr-1.5 inline h-4 w-4 text-yellow-400" />
            {r.semCliente.qtd} assinatura(s) ativa(s) no Asaas ({formatCurrency(r.semCliente.valor)}/mês) já com pagamento não estão ligadas a nenhum cliente e não entram no MRR.
          </span>
          <span className="shrink-0 text-xs text-yellow-400">Ligar →</span>
        </button>
      )}
      {r.semCliente.qtd === 0 && r.semCliente.aguardandoPagamento > 0 && (
        <p className="text-xs text-brand-lavanda/40">
          {r.semCliente.aguardandoPagamento} assinatura(s) nova(s) no Asaas ainda sem o 1º pagamento e sem cliente cadastrado. Quando pagar, cadastre o cliente e ligue em &quot;Só no Asaas&quot;.
        </p>
      )}

      {!r.asaasCarregando && recentes.length > 0 && (
        <a
          href="#cancelamentos"
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-brand-rosa/25 bg-brand-rosa/[0.06] px-4 py-2.5 text-sm text-brand-lavanda/80 transition-colors hover:bg-brand-rosa/[0.1]"
        >
          <span>
            <UserMinus className="mr-1.5 inline h-4 w-4 text-brand-rosa" />
            {recentes.length} assinatura(s) cancelada(s) nos últimos 30 dias: <b className="text-brand-rosa">-{formatCurrency(recentes.reduce((t, c) => t + c.valor, 0))}/mês</b> no MRR.
          </span>
          <span className="shrink-0 text-xs text-brand-rosa">Ver quem →</span>
        </a>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="MRR da agência"
          value={formatCurrency(bruto)}
          info="Receita recorrente por mês: soma das assinaturas ativas pelo valor cobrado, incluindo inadimplentes até a assinatura ser cancelada. Líquido = mensalidades lançadas no financeiro, já sem as taxas do Asaas."
          icon={Repeat}
          iconColor="text-brand-lima"
          sub={r.asaasCarregando
            ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> buscando no Asaas…</span>
            : <>Bruto · líquido <span className="text-brand-lavanda/70">{formatCurrency(liquido)}</span></>}
        />
        <KpiCard title="ARR (MRR × 12)" value={formatCurrency(bruto * 12)} icon={CalendarRange} sub="Receita recorrente anual" info="Quanto as assinaturas de hoje rendem em 12 meses se ninguém entrar nem sair." />
        <KpiCard
          title="Assinaturas"
          value={String(assinaturas)}
          info="Clientes com assinatura ativa ou que ainda devem mensalidade. Em dia = nada vencido; inadimplente = tem mensalidade vencida e não paga."
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
          info="MRR dividido pelo número de assinaturas ativas: quanto cada assinante paga por mês, em média."
          icon={Receipt}
          sub={atraso > 0 ? <span className="text-brand-rosa/80">{formatCurrency(atraso)} em atraso</span> : 'Ninguém em atraso'}
        />
      </div>

      {/* Por linha */}
      <ParaCobrar r={r} foco={focoCobranca} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Cancelamentos r={r} />
        <CustoAsaas r={r} />
      </div>

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
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-brand-lavanda/50" title="Assinatura ativa e nada vencido. Inadimplentes aparecem na coluna Inadimplência.">Ativas</th>
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
                    <td className="px-4 py-3 text-right text-brand-lavanda/70">{carregando ?? l.emDia}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-lavanda">{carregando ?? formatCurrency(l.mrrBruto)}</td>
                    <td className="px-4 py-3 text-right text-brand-lavanda/60">{carregando ?? formatCurrency(l.mrrLiquido)}</td>
                    <td className={cn('px-4 py-3 text-right', l.totalAtraso > 0 ? 'text-brand-rosa' : 'text-brand-lavanda/30')}>
                      {l.totalAtraso > 0 ? <>{formatCurrency(l.totalAtraso)} <span className="text-[11px]">({l.inadimplentes})</span></> : '—'}
                    </td>
                    <td className="pr-4"><ChevronRight className="h-4 w-4 text-brand-lavanda/20 group-hover:text-brand-lavanda/60" /></td>
                  </tr>
                ))}
                <tr className="bg-white/[0.02] font-semibold">
                  <td className="px-6 py-3 text-brand-lavanda">Agência (total)</td>
                  <td className="px-4 py-3 text-right text-brand-lavanda">{carregando ?? emDia}</td>
                  <td className="px-4 py-3 text-right text-brand-lima">{carregando ?? formatCurrency(bruto)}</td>
                  <td className="px-4 py-3 text-right text-brand-lavanda/70">{carregando ?? formatCurrency(liquido)}</td>
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
                {naPilha.map((l) => (
                  <Area key={l.linha} dataKey={l.linha} name={nomeLinha[l.linha]} stackId="mrr" type="monotone"
                    stroke={LINHA_CORES[l.linha]} fill={LINHA_CORES[l.linha]} fillOpacity={0.2} strokeWidth={2} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-end gap-4">
              {naPilha.map(({ linha: l }) => (
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
        Ativas = assinatura ativa e nada vencido (canceladas e inadimplentes ficam de fora). MRR bruto = assinaturas ativas no Asaas pelo valor cobrado (planos não mensais convertidos para mensal), incluindo inadimplentes até cancelarem; cliente fora do Asaas entra pelo valor lançado.
        Líquido, evolução e movimento vêm das mensalidades lançadas no financeiro (já sem as taxas do Asaas).
        Uma assinatura é do Catálogo Place ou da Clubelly quando o cliente é só desse SaaS (pelo produto do cadastro), quando as faturas dela estão ligadas a lançamentos dessa linha ou quando a descrição fala em &quot;Catálogo&quot; ou &quot;Clubelly&quot;; as demais são de Serviços.
      </p>
    </div>
  )
}

const mesesEntre = (de: string, ate: string) => Math.max(1, Math.round(diasEntre(de, ate) / 30.4) + 1)

// Assinaturas canceladas no Asaas depois de ter pago, pela data do último pagamento
// (o Asaas não diz quando cancelou).
function Cancelamentos({ r }: { r: Recorrencia }) {
  const { cancelamentos, valor } = r.churn
  return (
    <Card id="cancelamentos" className="scroll-mt-6 lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><UserMinus className="h-4 w-4 text-brand-rosa" /> Cancelamentos recentes</CardTitle>
          {cancelamentos.length > 0 && (
            <span className="text-sm font-semibold text-brand-rosa" style={{ fontFamily: 'var(--font-space-grotesk)' }}>-{formatCurrency(valor)}/mês</span>
          )}
        </div>
        <p className="text-xs text-brand-lavanda/40">
          Assinaturas canceladas no Asaas com último pagamento nos últimos {DIAS_CHURN_RECENTE} dias. Vale um contato para entender o motivo ou tentar trazer de volta.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {r.asaasCarregando ? (
          <p className="flex items-center gap-2 px-6 pb-6 text-sm text-brand-lavanda/40"><Loader2 className="h-4 w-4 animate-spin" /> Buscando no Asaas…</p>
        ) : !r.asaasLigado ? (
          <p className="px-6 pb-6 text-sm text-brand-lavanda/40">Precisa do Asaas configurado para saber quem cancelou.</p>
        ) : cancelamentos.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-brand-lavanda/40">Nenhum cancelamento nos últimos {DIAS_CHURN_RECENTE} dias.</p>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#141318]">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-6 py-2 text-left text-xs font-medium text-brand-lavanda/50">Cliente</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-brand-lavanda/50">Foi cliente</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-brand-lavanda/50">Último pagamento</th>
                  <th className="px-6 py-2 text-right text-xs font-medium text-brand-lavanda/50">Perdido</th>
                </tr>
              </thead>
              <tbody>
                {cancelamentos.map((c) => {
                  const meses = c.primeiroPagamento && c.ultimoPagamento ? mesesEntre(c.primeiroPagamento, c.ultimoPagamento) : null
                  const nome = (
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: LINHA_CORES[c.linha] }} title={nomeLinha[c.linha]} />
                      {c.nome}
                    </span>
                  )
                  return (
                    <tr key={c.chave} className="border-b border-white/[0.04]">
                      <td className="px-6 py-2.5 text-brand-lavanda">
                        {c.clienteId ? <Link href={`/clientes/${c.clienteId}`} className="hover:text-brand-lima">{nome}</Link> : nome}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-brand-lavanda/60">
                        {meses ? `${meses} ${meses === 1 ? 'mês' : 'meses'}` : '—'}
                        <span className="text-[11px] text-brand-lavanda/40"> · {c.pagamentos} pgto{c.pagamentos === 1 ? '' : 's'}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-brand-lavanda/60">{c.ultimoPagamento ? formatDate(c.ultimoPagamento) : '—'}</td>
                      <td className="px-6 py-2.5 text-right whitespace-nowrap font-medium text-brand-rosa">-{formatCurrency(c.valor)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Quanto o Asaas ficou de taxa (cobrado − o que caiu na conta), neste mês e no passado.
function CustoAsaas({ r }: { r: Recorrencia }) {
  const t = r.taxas
  const pctDe = (taxa: number, cobrado: number) => (cobrado > 0 ? `${((taxa / cobrado) * 100).toFixed(1).replace('.', ',')}%` : '—')
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Percent className="h-4 w-4 text-brand-rosa" /> Custo do Asaas</CardTitle>
        <p className="text-xs text-brand-lavanda/40">Taxas dos pagamentos recebidos: o que foi cobrado menos o que caiu na conta.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!t ? (
          <p className="text-brand-lavanda/40">Rode a migration <code>20261023000000_asaas_taxas.sql</code> e sincronize o Asaas para ver as taxas.</p>
        ) : (
          <>
            {[t.mesAtual, t.mesPassado].map((m, i) => (
              <div key={m.mes} className="space-y-0.5">
                <p className="text-xs text-brand-lavanda/50">{mesLabel(m.mes, 'MMMM')}{i === 0 && ' (até hoje)'}</p>
                <p className="text-xl font-semibold text-brand-rosa" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{formatCurrency(m.taxa)}</p>
                <p className="text-[11px] text-brand-lavanda/40">
                  {m.pagamentos} pagamento{m.pagamentos === 1 ? '' : 's'} · {pctDe(m.taxa, m.cobrado)} de {formatCurrency(m.cobrado)}
                </p>
              </div>
            ))}
            {t.mesPassado.taxa > 0 && (
              <p className="border-t border-white/[0.06] pt-3 text-xs text-brand-lavanda/60">
                No ritmo de {mesLabel(t.mesPassado.mes, 'MMMM').toLowerCase()}: cerca de <b className="text-brand-lavanda">{formatCurrency(t.mesPassado.taxa * 12)}</b> por ano.
              </p>
            )}
            <Link href="/catalogo/asaas" className="block text-xs text-brand-lima hover:underline">Ver taxa por pagamento e por forma →</Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}

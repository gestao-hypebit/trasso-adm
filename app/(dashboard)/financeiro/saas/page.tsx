'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { useRecorrencia } from '@/components/recorrencia/use-recorrencia'
import { createClient } from '@/lib/supabase/client'
import { LINHA_CORES, LINHAS_SAAS, labelLinha, type LinhaSaas } from '@/lib/financeiro/linhas'
import { CUSTO_AQUISICAO_RE, MARCOS_RETENCAO, safras, unitario, type Safra } from '@/lib/saas/metricas'
import { addMonthsISO, cn, formatCurrency, toISODateLocal } from '@/lib/utils'

type Lanc = { tipo: string; valor: number; status: string; frente: string; categorias_financeiras: { nome: string } | null }
type Mov = { frente: string; tipo: string }

const pct = (v: number | null, casas = 0) => (v === null ? '—' : `${(v * 100).toFixed(casas).replace('.', ',')}%`)
const mesLabel = (mes: string) => {
  const l = format(parseISO(`${mes}-01`), 'MMM/yy', { locale: ptBR })
  return l.charAt(0).toUpperCase() + l.slice(1)
}

// Os três últimos meses fechados: é a janela da margem e do CAC.
function janela() {
  const inicioMesAtual = `${toISODateLocal(new Date()).slice(0, 7)}-01`
  return { de: addMonthsISO(inicioMesAtual, -3), ate: inicioMesAtual }
}

// Resultado de cada SaaS lado a lado: MRR, margem, unidade econômica e retenção.
export default function SaasPage() {
  const pathname = usePathname()
  const r = useRecorrencia()
  const [lancs, setLancs] = useState<Lanc[] | null>(null)
  const [movs, setMovs] = useState<Mov[]>([])
  const { de, ate } = janela()

  useEffect(() => {
    const db = createClient() as any
    Promise.all([
      db.from('lancamentos').select('tipo, valor, status, frente, categorias_financeiras(nome)')
        .in('frente', LINHAS_SAAS).gte('data', de).lt('data', ate),
      db.from('metas_movimentacoes').select('frente, tipo').eq('tipo', 'novo').in('frente', LINHAS_SAAS).gte('data', de).lt('data', ate),
    ]).then(([l, m]: { data: unknown[] | null }[]) => {
      setLancs((l.data ?? []) as Lanc[])
      setMovs((m.data ?? []) as Mov[])
    })
  }, [de, ate])

  // Mensalidades de cada SaaS (para as safras): receitas da linha em categorias de mensalidade.
  const safrasPorLinha = useMemo(() => Object.fromEntries(LINHAS_SAAS.map((l) => [l, safras(
    r.dados.lancamentos
      .filter((x) => x.frente === l && !!x.categoria_id && r.dados.recorrentes.includes(x.categoria_id))
      .map((x) => ({ chave: x.cliente_id ?? `d:${x.descricao}`, data: x.data, status: x.status })),
    r.dados.hoje,
  )])) as Record<LinhaSaas, Safra[]>, [r.dados])

  const carregando = r.loading || r.asaasCarregando || lancs === null

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Financeiro" description="Resultado de cada SaaS" />
      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="SaaS" description="Catálogo Place e Clubelly lado a lado: receita recorrente, margem, quanto cada assinante rende e quanto custa conquistar" />
        <FinanceiroSubNav pathname={pathname} />

        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-brand-lavanda/40"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {LINHAS_SAAS.map((l) => {
                const calc = r.porLinha[l]
                const daLinha = lancs!.filter((x) => x.frente === l)
                const receita = daLinha.filter((x) => x.tipo === 'receita' && x.status === 'recebido').reduce((s, x) => s + Number(x.valor), 0)
                const despesas = daLinha.filter((x) => x.tipo === 'despesa' && x.status === 'pago').reduce((s, x) => s + Number(x.valor), 0)
                const aquisicao = daLinha.filter((x) => x.tipo === 'despesa' && x.status === 'pago' && CUSTO_AQUISICAO_RE.test(x.categorias_financeiras?.nome ?? ''))
                  .reduce((s, x) => s + Number(x.valor), 0)
                const novos = movs.filter((m) => m.frente === l).length
                const u = unitario({
                  ticket: calc.ativas ? calc.mrrLiquido / calc.ativas : 0,
                  churn: calc.mrr.churnMedio,
                  custoAquisicao: aquisicao,
                  novos,
                })
                return (
                  <Card key={l}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="h-3 w-3 rounded-sm" style={{ background: LINHA_CORES[l] }} /> {labelLinha(l)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <Grupo titulo="Agora">
                        <Dado rotulo="MRR bruto" valor={formatCurrency(calc.mrrBruto)} destaque />
                        <Dado rotulo="MRR líquido" valor={formatCurrency(calc.mrrLiquido)} />
                        <Dado rotulo="Assinantes em dia" valor={String(calc.emDia)} sub={calc.inadimplentes ? `${calc.inadimplentes} inadimplente(s)` : undefined} />
                      </Grupo>

                      <Grupo titulo="Últimos 3 meses fechados">
                        <Dado rotulo="Receita" valor={formatCurrency(receita)} />
                        <Dado rotulo="Custos da linha" valor={formatCurrency(despesas)} />
                        <Dado
                          rotulo="Margem"
                          valor={formatCurrency(receita - despesas)}
                          sub={receita > 0 ? pct((receita - despesas) / receita) : undefined}
                          cor={receita - despesas >= 0 ? 'text-brand-lima' : 'text-brand-rosa'}
                        />
                      </Grupo>

                      <Grupo titulo="Cada assinante">
                        <Dado rotulo="Ticket líquido" valor={formatCurrency(u.ticket)} sub="por mês" />
                        <Dado rotulo="Churn médio" valor={pct(u.churn, 1)} sub="por mês (6 meses)" />
                        <Dado rotulo="Fica em média" valor={u.vidaMeses === null ? '—' : `${Math.round(u.vidaMeses)} meses`} />
                        <Dado rotulo="Rende no total (LTV)" valor={u.ltv === null ? '—' : formatCurrency(u.ltv)} />
                        <Dado rotulo="Custo p/ conquistar (CAC)" valor={u.cac === null ? '—' : formatCurrency(u.cac)} sub={`${novos} novo(s) em 3 meses`} />
                        <Dado
                          rotulo="Paga o CAC em"
                          valor={u.payback === null ? '—' : u.payback < 1 ? 'menos de 1 mês' : `${u.payback.toFixed(1).replace('.', ',')} meses`}
                          sub={u.ltvPorCac === null ? undefined : `LTV ÷ CAC = ${u.ltvPorCac.toFixed(1).replace('.', ',')}`}
                          cor={u.ltvPorCac === null ? undefined : u.ltvPorCac >= 3 ? 'text-brand-lima' : 'text-yellow-400'}
                        />
                      </Grupo>

                      {u.cac === null && (
                        <p className="text-[11px] text-brand-lavanda/40">
                          {novos === 0
                            ? 'Sem cliente novo nas Metas nos últimos 3 meses: o CAC aparece quando houver.'
                            : `Nenhum custo de aquisição lançado na linha ${labelLinha(l)}. Lance tráfego pago, marketing e comissões de indicação com a linha deste SaaS (hoje a maioria está em "Geral") para o CAC aparecer.`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Retenção por safra</CardTitle>
                <p className="text-xs text-brand-lavanda/40">
                  Dos assinantes que começaram em cada mês, quantos ainda pagavam 1, 3 e 6 meses depois. Só meses fechados; pelas mensalidades lançadas no financeiro.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {LINHAS_SAAS.map((l) => (
                  <div key={l}>
                    <p className="mb-2 flex items-center gap-2 text-xs font-medium text-brand-lavanda/60">
                      <span className="h-2 w-2 rounded-sm" style={{ background: LINHA_CORES[l] }} /> {labelLinha(l)}
                    </p>
                    {safrasPorLinha[l].length === 0 ? (
                      <p className="text-sm text-brand-lavanda/40">Ainda sem histórico de mensalidades.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="px-2 py-2 text-left text-xs font-medium text-brand-lavanda/50">Safra</th>
                            <th className="px-2 py-2 text-right text-xs font-medium text-brand-lavanda/50">Clientes</th>
                            {MARCOS_RETENCAO.map((k) => <th key={k} className="px-2 py-2 text-right text-xs font-medium text-brand-lavanda/50">{k} {k === 1 ? 'mês' : 'meses'}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {safrasPorLinha[l].map((s) => (
                            <tr key={s.mes} className="border-b border-white/[0.04]">
                              <td className="px-2 py-2 text-brand-lavanda/70">{mesLabel(s.mes)}</td>
                              <td className="px-2 py-2 text-right text-brand-lavanda/70">{s.clientes}</td>
                              {MARCOS_RETENCAO.map((k) => {
                                const v = s.retencao[k]
                                return (
                                  <td key={k} className="px-2 py-2 text-right">
                                    {v === null ? <span className="text-brand-lavanda/20">—</span> : (
                                      <span
                                        className="inline-block min-w-12 rounded px-1.5 py-0.5 text-xs font-medium text-brand-lavanda"
                                        style={{ background: `color-mix(in srgb, ${LINHA_CORES[l]} ${Math.round(v * 45) + 5}%, transparent)` }}
                                      >
                                        {pct(v)}
                                      </span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <p className="text-[11px] text-brand-lavanda/30">
              Churn médio = média dos últimos 6 meses de quem tinha mensalidade num mês e não teve no seguinte. LTV = ticket líquido × tempo médio que um assinante fica (1 ÷ churn).
              CAC = custos de aquisição da linha (marketing, tráfego, comissões de indicação) nos últimos 3 meses ÷ clientes novos registrados nas Metas no mesmo período.
              Custos da empresa toda (linha &quot;Geral&quot;) não entram na margem de cada SaaS.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-wide text-brand-lavanda/40">{titulo}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{children}</div>
    </div>
  )
}

function Dado({ rotulo, valor, sub, destaque, cor }: { rotulo: string; valor: string; sub?: string; destaque?: boolean; cor?: string }) {
  return (
    <div>
      <p className="text-[11px] text-brand-lavanda/50">{rotulo}</p>
      <p className={cn(destaque ? 'text-lg' : 'text-base', 'font-semibold', cor ?? 'text-brand-lavanda')} style={{ fontFamily: 'var(--font-space-grotesk)' }}>{valor}</p>
      {sub && <p className="text-[11px] text-brand-lavanda/40">{sub}</p>}
    </div>
  )
}

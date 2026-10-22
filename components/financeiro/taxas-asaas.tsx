'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SeletorMes, intervaloPeriodo, periodoInicial, type Periodo } from '@/components/financeiro/seletor-mes'
import { createClient } from '@/lib/supabase/client'
import { LINHA_CORES, labelLinha, type Linha } from '@/lib/financeiro/linhas'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

type Transacao = {
  id: string
  data: string
  descricao: string
  frente: Linha
  forma_pagamento: string | null
  asaas_valor: number
  asaas_valor_liquido: number
  clientes: { nome: string } | null
}

const formaLabel: Record<string, string> = {
  pix: 'PIX', boleto: 'Boleto', cartao_credito: 'Cartão crédito', cartao_debito: 'Cartão débito',
}

const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`

// Quanto o Asaas cobrou de taxa em cada pagamento recebido no mês
// (cobrado do cliente − o que caiu na conta).
export function TaxasAsaas() {
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial)
  const [itens, setItens] = useState<Transacao[] | null>(null)
  const [semMigration, setSemMigration] = useState(false)

  useEffect(() => {
    let vivo = true
    const [de, ate] = intervaloPeriodo(periodo)
    setItens(null)
    ;(createClient() as any)
      .from('lancamentos')
      .select('id, data, descricao, frente, forma_pagamento, asaas_valor, asaas_valor_liquido, clientes(nome)')
      .eq('tipo', 'receita')
      .eq('status', 'recebido')
      .not('asaas_valor', 'is', null)
      .gte('data', de)
      .lte('data', ate)
      .order('data', { ascending: false })
      .then(({ data, error }: { data: Transacao[] | null; error: unknown }) => {
        if (!vivo) return
        setSemMigration(!!error)
        setItens((data ?? []).map((t) => ({ ...t, asaas_valor: Number(t.asaas_valor), asaas_valor_liquido: Number(t.asaas_valor_liquido) })))
      })
    return () => { vivo = false }
  }, [periodo])

  const taxa = (t: Transacao) => Math.max(t.asaas_valor - t.asaas_valor_liquido, 0)
  const cobrado = (itens ?? []).reduce((s, t) => s + t.asaas_valor, 0)
  const totalTaxas = (itens ?? []).reduce((s, t) => s + taxa(t), 0)

  // Por forma de pagamento: é o que mais muda a taxa.
  const porForma = [...(itens ?? []).reduce((m, t) => {
    const k = t.forma_pagamento ?? 'outro'
    const a = m.get(k) ?? { qtd: 0, cobrado: 0, taxa: 0 }
    m.set(k, { qtd: a.qtd + 1, cobrado: a.cobrado + t.asaas_valor, taxa: a.taxa + taxa(t) })
    return m
  }, new Map<string, { qtd: number; cobrado: number; taxa: number }>())].sort((a, b) => b[1].taxa - a[1].taxa)

  // Quanto teria saído mais barato se o que não foi PIX tivesse sido PIX
  // (pela taxa média por pagamento de PIX no próprio período).
  const pix = porForma.find(([f]) => f === 'pix')?.[1]
  const naoPix = porForma.filter(([f]) => f !== 'pix')
  const qtdNaoPix = naoPix.reduce((s, [, f]) => s + f.qtd, 0)
  const economia = pix && qtdNaoPix
    ? naoPix.reduce((s, [, f]) => s + f.taxa, 0) - qtdNaoPix * (pix.taxa / pix.qtd)
    : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Taxas do Asaas</CardTitle>
            <p className="text-xs text-brand-lavanda/40">Pagamentos recebidos pelo Asaas: valor cobrado, o que caiu na conta e a diferença.</p>
          </div>
          <SeletorMes valor={periodo} onChange={setPeriodo} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {semMigration ? (
          <p className="text-sm text-yellow-400">
            Rode a migration <code>20261023000000_asaas_taxas.sql</code> no Supabase e depois clique em &quot;Sincronizar agora&quot; para preencher as taxas.
          </p>
        ) : itens === null ? (
          <div className="flex items-center gap-2 py-6 text-sm text-brand-lavanda/40"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : itens.length === 0 ? (
          <p className="text-sm text-brand-lavanda/40">
            Nenhum pagamento recebido pelo Asaas neste período com a taxa registrada. Cobranças antigas passam a aparecer depois de &quot;Sincronizar agora&quot;.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Resumo rotulo="Pagamentos" valor={String(itens.length)} />
              <Resumo rotulo="Cobrado" valor={formatCurrency(cobrado)} />
              <Resumo rotulo="Caiu na conta" valor={formatCurrency(cobrado - totalTaxas)} />
              <Resumo rotulo="Taxas" valor={formatCurrency(totalTaxas)} sub={cobrado > 0 ? `${pct(totalTaxas / cobrado)} do cobrado` : undefined} destaque />
            </div>

            {porForma.length > 1 && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-brand-lavanda/60">
                {porForma.map(([forma, f]) => (
                  <span key={forma}>
                    {formaLabel[forma] ?? 'Outra'}: <span className="text-brand-lavanda">{formatCurrency(f.taxa)}</span>
                    <span className="text-brand-lavanda/40"> em {f.qtd} pagamento{f.qtd === 1 ? '' : 's'} · {f.cobrado > 0 ? pct(f.taxa / f.cobrado) : '—'}</span>
                  </span>
                ))}
              </div>
            )}

            {economia >= 1 && (
              <p className="rounded-lg border border-brand-lima/20 bg-brand-lima/[0.05] px-3 py-2 text-xs text-brand-lavanda/80">
                Se os {qtdNaoPix} pagamento{qtdNaoPix === 1 ? '' : 's'} fora do PIX tivessem sido no PIX, a taxa seria{' '}
                <b className="text-brand-lima">{formatCurrency(economia)} menor</b> neste período
                {!periodo.tudo && <> (cerca de {formatCurrency(economia * 12)} por ano)</>}. Vale oferecer PIX como forma padrão nas assinaturas.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-3 py-2 text-left text-xs font-medium text-brand-lavanda/50">Vencimento</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-brand-lavanda/50">Cliente</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-brand-lavanda/50">Forma</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-brand-lavanda/50">Cobrado</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-brand-lavanda/50">Caiu na conta</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-brand-lavanda/50">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((t) => (
                    <tr key={t.id} className="border-b border-white/[0.04]">
                      <td className="px-3 py-2 whitespace-nowrap text-brand-lavanda/60">{formatDate(t.data)}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2 text-brand-lavanda">
                          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: LINHA_CORES[t.frente] }} title={labelLinha(t.frente)} />
                          {t.clientes?.nome?.trim() ?? t.descricao}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-brand-lavanda/60">{t.forma_pagamento ? formaLabel[t.forma_pagamento] ?? t.forma_pagamento : '—'}</td>
                      <td className="px-3 py-2 text-right text-brand-lavanda/70">{formatCurrency(t.asaas_valor)}</td>
                      <td className="px-3 py-2 text-right text-brand-lavanda/70">{formatCurrency(t.asaas_valor_liquido)}</td>
                      <td className={cn('px-3 py-2 text-right whitespace-nowrap', taxa(t) > 0 ? 'text-brand-rosa' : 'text-brand-lavanda/30')}>
                        {formatCurrency(taxa(t))}
                        {t.asaas_valor > 0 && <span className="block text-[11px] text-brand-lavanda/40">{pct(taxa(t) / t.asaas_valor)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Resumo({ rotulo, valor, sub, destaque }: { rotulo: string; valor: string; sub?: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-brand-lavanda/40">{rotulo}</p>
      <p className={cn('text-lg font-semibold', destaque ? 'text-brand-rosa' : 'text-brand-lavanda')} style={{ fontFamily: 'var(--font-space-grotesk)' }}>{valor}</p>
      {sub && <p className="text-[11px] text-brand-lavanda/40">{sub}</p>}
    </div>
  )
}

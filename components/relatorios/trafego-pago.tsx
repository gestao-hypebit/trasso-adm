'use client'

// Aba "Tráfego pago" de /relatorios: quanto foi investido em anúncios contra
// quanto os clientes com origem "Tráfego pago" já pagaram.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Megaphone, Users, Wallet, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { createClient } from '@/lib/supabase/client'
import { labelOrigem } from '@/lib/crm/opcoes'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

const ORIGEM = 'trafego_pago'
// Despesa conta como investimento em tráfego quando a categoria tem um destes nomes.
const CATEGORIA_TRAFEGO = /tr[aá]fego|an[uú]ncio|\bads\b/i

const PERIODOS = [
  { value: '3', label: 'Últimos 3 meses' },
  { value: '6', label: 'Últimos 6 meses' },
  { value: '12', label: 'Últimos 12 meses' },
  { value: 'todo', label: 'Todo o período' },
]

type Cliente = { id: string; nome: string; empresa: string | null; origem: string | null; status: string; created_at: string }
type Lancamento = { tipo: string; valor: number; data: string; cliente_id: string | null; categorias_financeiras: { nome: string } | null }

export function TrafegoPago() {
  const [periodo, setPeriodo] = useState('12')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: c }, { data: l }] = await Promise.all([
        supabase.from('clientes').select('id, nome, empresa, origem, status, created_at'),
        supabase.from('lancamentos').select('tipo, valor, data, cliente_id, categorias_financeiras(nome)').in('status', ['recebido', 'pago']),
      ])
      setClientes((c as Cliente[]) ?? [])
      setLancamentos((l as unknown as Lancamento[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const r = useMemo(() => {
    const corte = periodo === 'todo' ? '' : (() => {
      const d = new Date()
      d.setMonth(d.getMonth() - Number(periodo))
      return d.toISOString().slice(0, 10)
    })()

    const receitaPorCliente = new Map<string, number>()
    for (const l of lancamentos) {
      if (l.tipo !== 'receita' || !l.cliente_id) continue
      receitaPorCliente.set(l.cliente_id, (receitaPorCliente.get(l.cliente_id) ?? 0) + Number(l.valor))
    }

    const investimento = lancamentos
      .filter((l) => l.tipo === 'despesa' && l.data >= corte && CATEGORIA_TRAFEGO.test(l.categorias_financeiras?.nome ?? ''))
      .reduce((s, l) => s + Number(l.valor), 0)

    const noPeriodo = clientes.filter((c) => c.created_at.slice(0, 10) >= corte)
    const doTrafego = noPeriodo
      .filter((c) => c.origem === ORIGEM)
      .map((c) => ({ ...c, receita: receitaPorCliente.get(c.id) ?? 0 }))
      .sort((a, b) => b.receita - a.receita)

    const receita = doTrafego.reduce((s, c) => s + c.receita, 0)
    const pagantes = doTrafego.filter((c) => c.receita > 0).length

    // Comparativo com as outras origens, no mesmo período.
    const porOrigem = new Map<string, { clientes: number; receita: number }>()
    for (const c of noPeriodo) {
      const k = c.origem || 'sem_origem'
      const linha = porOrigem.get(k) ?? { clientes: 0, receita: 0 }
      linha.clientes++
      linha.receita += receitaPorCliente.get(c.id) ?? 0
      porOrigem.set(k, linha)
    }

    return {
      investimento,
      receita,
      clientes: doTrafego,
      pagantes,
      cac: pagantes ? investimento / pagantes : null,
      roi: investimento ? ((receita - investimento) / investimento) * 100 : null,
      origens: [...porOrigem.entries()]
        .map(([origem, v]) => ({ origem, ...v, media: v.clientes ? v.receita / v.clientes : 0 }))
        .sort((a, b) => b.receita - a.receita),
    }
  }, [clientes, lancamentos, periodo])

  const retorno = r.receita - r.investimento

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-lavanda/50 max-w-2xl">
          Clientes cadastrados no período com origem <span className="text-brand-lavanda">Tráfego pago</span>, e tudo o que já pagaram,
          comparado com as despesas pagas em categorias de tráfego/anúncios no mesmo período.
        </p>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Investido em tráfego" value={formatCurrency(r.investimento)} icon={Megaphone} iconColor="text-brand-rosa" />
        <KpiCard title="Clientes do tráfego" value={String(r.clientes.length)} icon={Users}
          sub={`${r.pagantes} já pagaram`} />
        <KpiCard title="Receita desses clientes" value={formatCurrency(r.receita)} icon={Wallet} iconColor="text-brand-lima"
          sub={r.cac !== null ? `Custo por cliente pagante: ${formatCurrency(r.cac)}` : undefined} />
        <KpiCard title="Retorno (ROI)" value={r.roi !== null ? `${Math.round(r.roi)}%` : '—'} icon={TrendingUp}
          iconColor={retorno >= 0 ? 'text-brand-lima' : 'text-brand-rosa'}
          sub={r.investimento ? `${retorno >= 0 ? 'Lucro' : 'Prejuízo'} de ${formatCurrency(Math.abs(retorno))}` : undefined} />
      </div>

      {!loading && r.investimento === 0 && (
        <p className="text-xs text-brand-lavanda/50 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          Nenhum gasto com tráfego encontrado no período. Para o ROI funcionar, crie uma categoria de despesa chamada
          {' '}<span className="text-brand-lavanda">Tráfego pago</span> em <Link href="/configuracoes" className="text-brand-lima">Configurações</Link>{' '}
          e lance nela o valor gasto com anúncios (Meta Ads, Google Ads…).
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Clientes vindos do tráfego</CardTitle></CardHeader>
          <CardContent className="p-0">
            {r.clientes.length === 0 ? (
              <p className="text-xs text-brand-lavanda/40 text-center py-12 px-6">
                {loading ? 'Carregando...' : 'Nenhum cliente com origem "Tráfego pago" no período. Marque a origem no cadastro do cliente.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left">
                      <th className="text-xs text-brand-lavanda/50 font-medium px-6 py-3">Cliente</th>
                      <th className="text-xs text-brand-lavanda/50 font-medium px-4 py-3">Desde</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-6 py-3">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.clientes.map((c) => (
                      <tr key={c.id} className="border-b border-white/[0.04]">
                        <td className="px-6 py-3">
                          <Link href={`/clientes/${c.id}`} className="text-brand-lavanda hover:text-brand-lima">{c.nome}</Link>
                          {c.empresa && <p className="text-[11px] text-brand-lavanda/40">{c.empresa}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-brand-lavanda/60 whitespace-nowrap">{formatDate(c.created_at)}</td>
                        <td className={cn('px-6 py-3 text-right whitespace-nowrap', c.receita > 0 ? 'text-brand-lima' : 'text-brand-lavanda/40')}>
                          {formatCurrency(c.receita)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Comparativo por origem</CardTitle></CardHeader>
          <CardContent className="p-0">
            {r.origens.length === 0 ? (
              <p className="text-xs text-brand-lavanda/40 text-center py-12">{loading ? 'Carregando...' : 'Sem dados'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left">
                      <th className="text-xs text-brand-lavanda/50 font-medium px-6 py-3">Origem</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Clientes</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Receita</th>
                      <th className="text-right text-xs text-brand-lavanda/50 font-medium px-6 py-3">Por cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.origens.map((o) => (
                      <tr key={o.origem} className={cn('border-b border-white/[0.04]', o.origem === ORIGEM && 'bg-white/[0.03] font-semibold')}>
                        <td className="px-6 py-3 text-brand-lavanda">{o.origem === 'sem_origem' ? 'Sem origem' : labelOrigem(o.origem)}</td>
                        <td className="px-4 py-3 text-right text-brand-lavanda/70">{o.clientes}</td>
                        <td className="px-4 py-3 text-right text-brand-lavanda/70 whitespace-nowrap">{formatCurrency(o.receita)}</td>
                        <td className="px-6 py-3 text-right text-brand-lima whitespace-nowrap">{formatCurrency(o.media)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

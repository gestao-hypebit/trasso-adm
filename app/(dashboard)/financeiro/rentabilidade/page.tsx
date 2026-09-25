'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Info, ArrowUpDown } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { createClient } from '@/lib/supabase/client'
import { calcularRentabilidade, corMargem, type Rentabilidade } from '@/lib/financeiro/rentabilidade'
import { formatCurrency, cn } from '@/lib/utils'

type Projeto = { id: string; nome: string; tipo: string | null; status: string; valor: number | null; horas_estimadas: number | null; clientes: { nome: string } | null }
type Linha = Projeto & { r: Rentabilidade }
type Filtro = 'todos' | 'ativos' | 'concluidos'
type Ordem = 'margem' | 'lucro' | 'receita' | 'horas'

const tipoLabel: Record<string, string> = {
  site: 'Site', software: 'Software', identidade_visual: 'Identidade Visual',
  marketing: 'Marketing', social_media: 'Social Media', outro: 'Outro',
}
const statusLabel: Record<string, string> = {
  backlog: 'Backlog', em_andamento: 'Em andamento', aguardando_cliente: 'Aguardando cliente',
  em_revisao: 'Em revisão', concluido: 'Concluído', cancelado: 'Cancelado',
}

const pct = (m: number | null) => (m === null ? '—' : `${(m * 100).toFixed(0)}%`)

export default function RentabilidadePage() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [custoHora, setCustoHora] = useState(0)
  const [semTabelaHoras, setSemTabelaHoras] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [ordem, setOrdem] = useState<Ordem>('margem')

  useEffect(() => {
    const supabase = createClient() as any
    async function load() {
      const [{ data: projetos }, { data: lanc }, { data: horas, error: errHoras }, { data: cfg }] = await Promise.all([
        supabase.from('projetos').select('*, clientes(nome)').neq('status', 'cancelado'),
        supabase.from('lancamentos').select('projeto_id, tipo, valor, status').not('projeto_id', 'is', null),
        supabase.from('apontamentos_horas').select('projeto_id, horas'),
        supabase.from('configuracoes_agencia').select('custo_hora').limit(1).maybeSingle(),
      ])
      const ch = Number(cfg?.custo_hora ?? 0)
      setCustoHora(ch)
      setSemTabelaHoras(!!errHoras)
      const lancPor: Record<string, typeof lanc> = {}
      for (const l of lanc ?? []) (lancPor[l.projeto_id] ??= []).push(l)
      const horasPor: Record<string, typeof horas> = {}
      for (const h of horas ?? []) (horasPor[h.projeto_id] ??= []).push(h)
      setLinhas(((projetos ?? []) as Projeto[]).map((p) => ({
        ...p,
        r: calcularRentabilidade(p.valor, lancPor[p.id] ?? [], horasPor[p.id] ?? [], ch),
      })))
      setLoading(false)
    }
    load()
  }, [])

  const visiveis = useMemo(() => {
    const f = linhas.filter((l) =>
      filtro === 'todos' || (filtro === 'concluidos' ? l.status === 'concluido' : l.status !== 'concluido'))
    const chave: Record<Ordem, (l: Linha) => number> = {
      margem: (l) => l.r.margem ?? -Infinity,
      lucro: (l) => l.r.lucro,
      receita: (l) => l.r.receitaPrevista,
      horas: (l) => l.r.horas,
    }
    // Margem: piores primeiro, para destacar o que precisa de atenção.
    return [...f].sort((a, b) => ordem === 'margem' ? chave.margem(a) - chave.margem(b) : chave[ordem](b) - chave[ordem](a))
  }, [linhas, filtro, ordem])

  const porTipo = useMemo(() => {
    const grupos: Record<string, { receita: number; custos: number; lucro: number; horas: number; qtd: number }> = {}
    for (const l of visiveis) {
      const k = l.tipo ?? 'outro'
      const g = (grupos[k] ??= { receita: 0, custos: 0, lucro: 0, horas: 0, qtd: 0 })
      g.receita += l.r.receitaPrevista
      g.custos += l.r.custosDiretos + l.r.custoHoras
      g.lucro += l.r.lucro
      g.horas += l.r.horas
      g.qtd++
    }
    return Object.entries(grupos)
      .map(([tipo, g]) => ({ tipo, ...g, margem: g.receita > 0 ? g.lucro / g.receita : null, valorHora: g.horas > 0 ? (g.receita - (g.custos - g.horas * custoHora)) / g.horas : null }))
      .sort((a, b) => b.receita - a.receita)
  }, [visiveis, custoHora])

  const total = visiveis.reduce((s, l) => ({
    receita: s.receita + l.r.receitaPrevista, lucro: s.lucro + l.r.lucro, horas: s.horas + l.r.horas,
    custos: s.custos + l.r.custosDiretos + l.r.custoHoras,
  }), { receita: 0, lucro: 0, horas: 0, custos: 0 })
  const margemTotal = total.receita > 0 ? total.lucro / total.receita : null
  const negativos = visiveis.filter((l) => l.r.lucro < 0).length

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Rentabilidade por projeto" />
      <main className="flex-1 p-6">
        <PageHeader title="Financeiro" description="Rentabilidade por projeto">
          <div className="flex rounded-lg border border-white/[0.1] p-0.5">
            {([['todos', 'Todos'], ['ativos', 'Em andamento'], ['concluidos', 'Concluídos']] as const).map(([k, label]) => (
              <Button key={k} size="sm" variant={filtro === k ? 'violeta' : 'ghost'} className="h-7" onClick={() => setFiltro(k)}>{label}</Button>
            ))}
          </div>
        </PageHeader>

        <FinanceiroSubNav pathname={pathname} />

        {(custoHora === 0 || semTabelaHoras) && !loading && (
          <div className="mb-6 flex gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-3 text-xs text-yellow-300/90">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              {semTabelaHoras
                ? 'A tabela de horas ainda não existe no banco. Rode a migration 20260924000000_rentabilidade_contratos.sql no Supabase.'
                : <>O custo/hora está zerado, então o lucro considera só as despesas diretas. Defina em <Link href="/configuracoes" className="underline">Configurações → Numeração e custos</Link>.</>}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
          {[
            { label: 'Receita dos projetos', valor: formatCurrency(total.receita), sub: `${visiveis.length} projeto(s)`, cor: 'text-brand-lavanda' },
            { label: 'Custos (diretos + horas)', valor: formatCurrency(total.custos), sub: `${total.horas.toLocaleString('pt-BR')}h registradas`, cor: 'text-brand-lavanda' },
            { label: 'Lucro', valor: formatCurrency(total.lucro), sub: `margem ${pct(margemTotal)}`, cor: corMargem(margemTotal) },
            { label: 'Projetos no prejuízo', valor: String(negativos), sub: negativos ? 'revise escopo ou preço' : 'nenhum 🎉', cor: negativos ? 'text-brand-rosa' : 'text-brand-lavanda' },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="p-5">
                <p className="text-xs text-brand-lavanda/50">{k.label}</p>
                <p className={cn('text-2xl font-bold mt-1', k.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>{loading ? '—' : k.valor}</p>
                <p className="text-[11px] text-brand-lavanda/40 mt-0.5">{k.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Por tipo de serviço</CardTitle>
            <p className="text-xs text-brand-lavanda/50">Mostra quais linhas (site, software, identidade...) dão mais retorno por hora trabalhada.</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Tipo</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Projetos</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Receita</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Lucro</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Margem</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-6 py-3">R$/hora efetivo</th>
                  </tr>
                </thead>
                <tbody>
                  {porTipo.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-brand-lavanda/40 text-sm">{loading ? 'Carregando...' : 'Nenhum projeto.'}</td></tr>
                  ) : porTipo.map((g) => (
                    <tr key={g.tipo} className="border-b border-white/[0.04]">
                      <td className="px-6 py-2.5 font-medium text-brand-lavanda">{tipoLabel[g.tipo] ?? g.tipo}</td>
                      <td className="px-3 py-2.5 text-right text-brand-lavanda/70">{g.qtd}</td>
                      <td className="px-3 py-2.5 text-right text-brand-lavanda/80 whitespace-nowrap">{formatCurrency(g.receita)}</td>
                      <td className="px-3 py-2.5 text-right text-brand-lavanda/80 whitespace-nowrap">{formatCurrency(g.lucro)}</td>
                      <td className={cn('px-3 py-2.5 text-right font-semibold', corMargem(g.margem))}>{pct(g.margem)}</td>
                      <td className="px-6 py-2.5 text-right text-brand-lavanda/80 whitespace-nowrap">{g.valorHora !== null ? formatCurrency(g.valorHora) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Projetos</CardTitle>
              <div className="flex items-center gap-1 text-xs text-brand-lavanda/50">
                <ArrowUpDown className="h-3.5 w-3.5" />
                {([['margem', 'Pior margem'], ['lucro', 'Lucro'], ['receita', 'Receita'], ['horas', 'Horas']] as const).map(([k, label]) => (
                  <Button key={k} size="sm" variant={ordem === k ? 'violeta' : 'ghost'} className="h-7" onClick={() => setOrdem(k)}>{label}</Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Projeto</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-3 py-3">Status</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Receita</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Custos diretos</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Horas</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Lucro</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-6 py-3">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-brand-lavanda/40 text-sm">{loading ? 'Carregando...' : 'Nenhum projeto.'}</td></tr>
                  ) : visiveis.map((l) => (
                    <tr key={l.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-6 py-2.5">
                        <Link href={`/projetos/${l.id}`} className="font-medium text-brand-lavanda hover:text-brand-lima">{l.nome}</Link>
                        <p className="text-xs text-brand-lavanda/40">{l.clientes?.nome ?? 'Sem cliente'}{l.tipo ? ` · ${tipoLabel[l.tipo] ?? l.tipo}` : ''}</p>
                      </td>
                      <td className="px-3 py-2.5"><Badge variant={l.status === 'concluido' ? 'concluido' : 'default'}>{statusLabel[l.status] ?? l.status}</Badge></td>
                      <td className="px-3 py-2.5 text-right text-brand-lavanda/80 whitespace-nowrap">{formatCurrency(l.r.receitaPrevista)}</td>
                      <td className="px-3 py-2.5 text-right text-brand-lavanda/60 whitespace-nowrap">{formatCurrency(l.r.custosDiretos)}</td>
                      <td className="px-3 py-2.5 text-right text-brand-lavanda/60 whitespace-nowrap">
                        {l.r.horas.toLocaleString('pt-BR')}h{l.horas_estimadas ? <span className="text-brand-lavanda/30"> / {l.horas_estimadas}h</span> : ''}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-brand-lavanda whitespace-nowrap">{formatCurrency(l.r.lucro)}</td>
                      <td className={cn('px-6 py-2.5 text-right font-semibold', corMargem(l.r.margem))}>{pct(l.r.margem)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

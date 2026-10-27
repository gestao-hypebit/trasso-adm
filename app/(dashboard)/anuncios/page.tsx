'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BadgeDollarSign, Megaphone, Repeat, TriangleAlert, UserPlus, Wallet } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AnunciosSubNav, SeletorPeriodo } from '@/components/anuncios/anuncios-sub-nav'
import { GraficoGasto, type Serie } from '@/components/anuncios/grafico-gasto'
import { intervalo, useAnuncios } from '@/components/anuncios/use-anuncios'
import { diasEntre, resumir, type Metrica, type Resumo } from '@/lib/anuncios/regras'
import { formatCurrency, formatDate } from '@/lib/utils'

const SEM_MARCA = { id: 'sem', nome: 'Sem marca', cor: '#6B6880', slug: 'sem-marca' }
const moeda = (v: number | null) => (v === null ? '—' : formatCurrency(v))

export default function AnunciosPage() {
  const [periodo, setPeriodo] = useState('30')
  const [filtro, setFiltro] = useState('todas')
  const busca = useMemo(() => intervalo(periodo), [periodo])
  const a = useAnuncios(busca.de, busca.ate)
  const ate = busca.ate
  const de = periodo === 'tudo' ? a.inicio ?? ate : busca.de

  const r = useMemo(() => {
    const gastoDe = (ms: Metrica[]) => ms.reduce((s, m) => s + Number(m.spend), 0)
    // Marca inativa só aparece se gastou no período.
    const entidades = [
      ...a.marcas.map((m) => ({ ...m, ...a.daMarca(m.id) })),
      { ...SEM_MARCA, ativo: false, ...a.daMarca(null) },
    ].filter((e) => e.ativo || gastoDe(e.metricas) > 0)

    const comparativo = entidades.map((e) => ({ ...e, resumo: resumir(e.metricas, e.clientes, de, ate) }))
    const escolhidas = filtro === 'todas' ? comparativo : comparativo.filter((e) => e.id === filtro)
    const total = filtro === 'todas'
      ? resumir(a.metricas, a.clientes, de, ate)
      : escolhidas[0]?.resumo ?? resumir([], [], de, ate)

    const series: Serie[] = escolhidas.map((e) => ({ chave: e.id, nome: e.nome, cor: e.cor }))
    const porDia = new Map(diasEntre(de, ate).map((d) => [d, Object.fromEntries(series.map((s) => [s.chave, 0])) as Record<string, number>]))
    for (const e of escolhidas) for (const m of e.metricas) {
      const dia = porDia.get(m.data)
      if (dia) dia[e.id] += Number(m.spend)
    }
    const dados = [...porDia].map(([dia, v]) => ({ dia, ...v }))

    const comGasto = new Set(a.metricas.map((m) => m.campaign_id))
    const semMarca = a.campanhas.filter((c) => !c.marca_id && c.origem !== 'manual' && comGasto.has(c.campaign_id)).length
    return { comparativo, total, series, dados, semMarca }
  }, [a.marcas, a.metricas, a.clientes, a.campanhas, a.daMarca, de, ate, filtro])

  const t = r.total

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Anúncios" description="Gasto e resultado por marca" />

      <main className="flex-1 p-4 md:p-6">
        <AnunciosSubNav semMarca={r.semMarca} />
        <PageHeader title="Visão geral" description={`${periodo === 'tudo' ? 'Desde o início: ' : ''}${formatDate(de)} a ${formatDate(ate)} · horário de Brasília`}>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as marcas</SelectItem>
              {a.marcas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
              <SelectItem value="sem">Sem marca</SelectItem>
            </SelectContent>
          </Select>
          <SeletorPeriodo value={periodo} onChange={setPeriodo} />
        </PageHeader>

        {a.erro && <p className="mb-4 text-sm text-brand-rosa">{a.erro}</p>}

        {a.loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : (
          <div className="space-y-6">
            {r.semMarca > 0 && (
              <Link href="/anuncios/sem-marca" className="flex items-center gap-2 rounded-xl border border-brand-rosa/20 bg-brand-rosa/[0.06] px-4 py-3 text-sm text-brand-lavanda/80 hover:bg-brand-rosa/[0.1]">
                <TriangleAlert className="h-4 w-4 shrink-0 text-brand-rosa" />
                {r.semMarca} {r.semMarca === 1 ? 'campanha com gasto no período está' : 'campanhas com gasto no período estão'} sem marca. Atribuir →
              </Link>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KpiCard title="Gasto" value={formatCurrency(t.gasto)} icon={Megaphone} iconColor="text-brand-rosa" />
              <KpiCard title="Cadastros" value={String(t.cadastros)} icon={UserPlus} sub={`${t.conversoesMeta} segundo o Meta`} />
              <KpiCard title="Assinaturas" value={String(t.assinaturas)} icon={Repeat} iconColor="text-brand-lima" />
              <KpiCard title="Custo por cadastro" value={moeda(t.custoPorCadastro)} icon={BadgeDollarSign} />
              <KpiCard title="CAC" value={moeda(t.cac)} icon={BadgeDollarSign} sub="gasto ÷ novos pagantes" />
              <KpiCard title="Receita mensal gerada" value={formatCurrency(t.mrr)} icon={Wallet} iconColor="text-brand-lima" sub="MRR dos novos assinantes" />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-sm">Gasto por dia</CardTitle></CardHeader>
              <CardContent><GraficoGasto dados={r.dados} series={r.series} /></CardContent>
            </Card>

            <div>
              <h2 className="mb-3 text-sm font-semibold text-brand-lavanda">Comparativo entre marcas</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {r.comparativo.map((e) => <CartaoMarca key={e.id} id={e.id} slug={e.slug} nome={e.nome} cor={e.cor} r={e.resumo} />)}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function CartaoMarca({ id, slug, nome, cor, r }: { id: string; slug: string; nome: string; cor: string; r: Resumo }) {
  const linhas: [string, string][] = [
    ['Gasto', formatCurrency(r.gasto)],
    ['Cliques no link', r.cliques.toLocaleString('pt-BR')],
    ['Cadastros', String(r.cadastros)],
    ['Assinaturas', String(r.assinaturas)],
    ['Custo por cadastro', moeda(r.custoPorCadastro)],
    ['CAC', moeda(r.cac)],
    ['Receita mensal gerada', formatCurrency(r.mrr)],
  ]
  return (
    <Link href={id === 'sem' ? '/anuncios/sem-marca' : `/anuncios/${slug}`}>
      <Card className="h-full transition-colors hover:border-white/[0.14]">
        <CardContent className="p-5">
          <p className="mb-4 flex items-center gap-2 font-semibold text-brand-lavanda">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />{nome}
          </p>
          <dl className="space-y-1.5 text-sm">
            {linhas.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-brand-lavanda/50">{k}</dt>
                <dd className="tabular-nums text-brand-lavanda">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </Link>
  )
}

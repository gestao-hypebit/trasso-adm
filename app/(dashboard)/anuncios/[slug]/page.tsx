'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { BadgeDollarSign, Megaphone, Repeat, UserPlus, Wallet } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AnunciosSubNav, SeletorPeriodo } from '@/components/anuncios/anuncios-sub-nav'
import { GraficoGasto } from '@/components/anuncios/grafico-gasto'
import { StatusCampanha, TabelaDesempenho } from '@/components/anuncios/tabela-desempenho'
import { intervalo, useAnuncios } from '@/components/anuncios/use-anuncios'
import { gastoPorDia, porGrupo, resumir } from '@/lib/anuncios/regras'
import { formatCurrency, formatDate } from '@/lib/utils'

const moeda = (v: number | null) => (v === null ? '—' : formatCurrency(v))

export default function MarcaAnunciosPage() {
  const { slug } = useParams<{ slug: string }>()
  const [periodo, setPeriodo] = useState('30')
  const busca = useMemo(() => intervalo(periodo), [periodo])
  const a = useAnuncios(busca.de, busca.ate)
  const ate = busca.ate
  const de = periodo === 'tudo' ? a.inicio ?? ate : busca.de
  const marca = a.marcas.find((m) => m.slug === slug)

  const r = useMemo(() => {
    if (!marca) return null
    const { metricas, clientes } = a.daMarca(marca.id)
    const campanhaPorId = new Map(a.campanhas.map((c) => [c.campaign_id, c]))
    const anuncios = porGrupo(metricas, clientes, de, ate, 'ad')
    return {
      resumo: resumir(metricas, clientes, de, ate),
      dias: gastoPorDia(metricas, de, ate),
      campanhas: porGrupo(metricas, clientes, de, ate, 'campaign').map((c) => {
        const info = campanhaPorId.get(c.id)
        return {
          ...c,
          nome: info?.nome ?? c.nome,
          extra: <StatusCampanha status={info?.effective_status ?? info?.status ?? null} orcamentoDiario={info?.orcamento_diario ?? null} orcamentoTotal={info?.orcamento_total ?? null} />,
        }
      }),
      anunciosDe: (campaignId: string) => anuncios.filter((x) => x.campaign_id === campaignId),
    }
  }, [marca, a.daMarca, a.campanhas, de, ate])

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Anúncios" description={marca?.nome ?? 'Marca'} />

      <main className="flex-1 p-4 md:p-6">
        <AnunciosSubNav />
        <PageHeader title={marca?.nome ?? 'Marca'} description={`${periodo === 'tudo' ? 'Desde o início: ' : ''}${formatDate(de)} a ${formatDate(ate)} · horário de Brasília`}>
          {marca && <Button asChild size="sm" variant="outline"><Link href={`/anuncios/funil?marca=${marca.slug}`}>Ver funil</Link></Button>}
          <SeletorPeriodo value={periodo} onChange={setPeriodo} />
        </PageHeader>

        {a.erro && <p className="mb-4 text-sm text-brand-rosa">{a.erro}</p>}

        {a.loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : !marca || !r ? (
          <p className="py-20 text-center text-sm text-brand-lavanda/40">Marca não encontrada.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KpiCard title="Gasto" value={formatCurrency(r.resumo.gasto)} icon={Megaphone} iconColor="text-brand-rosa" />
              <KpiCard title="Cadastros" value={String(r.resumo.cadastros)} icon={UserPlus} sub={`${r.resumo.conversoesMeta} segundo o Meta`} />
              <KpiCard title="Assinaturas" value={String(r.resumo.assinaturas)} icon={Repeat} iconColor="text-brand-lima" />
              <KpiCard title="Custo por cadastro" value={moeda(r.resumo.custoPorCadastro)} icon={BadgeDollarSign} />
              <KpiCard title="CAC" value={moeda(r.resumo.cac)} icon={BadgeDollarSign} sub="gasto ÷ novos pagantes" />
              <KpiCard title="Receita mensal gerada" value={formatCurrency(r.resumo.mrr)} icon={Wallet} iconColor="text-brand-lima" sub="MRR dos novos assinantes" />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-sm">Gasto por dia</CardTitle></CardHeader>
              <CardContent>
                <GraficoGasto dados={r.dias} series={[{ chave: 'gasto', nome: marca.nome, cor: marca.cor }]} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Campanhas</CardTitle>
                <p className="text-xs text-brand-lavanda/40">Clique numa campanha para ver os anúncios. Cadastros e assinaturas contam pelo anúncio/campanha de origem do cliente.</p>
              </CardHeader>
              <CardContent>
                <TabelaDesempenho linhas={r.campanhas} filhas={r.anunciosDe} vazio="Nenhum gasto desta marca no período." />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

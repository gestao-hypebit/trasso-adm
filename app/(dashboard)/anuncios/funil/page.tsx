'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CornerDownRight } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AnunciosSubNav, SeletorPeriodo } from '@/components/anuncios/anuncios-sub-nav'
import { intervalo, useAnuncios } from '@/components/anuncios/use-anuncios'
import { buscarTudo } from '@/lib/anuncios/consulta'
import { calcularFunil, type EtapaCalculada, type Fonte, type PixelDia } from '@/lib/anuncios/funil'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

type Pixel = { pixel_id: string; nome: string; marca_id: string | null; erro: string | null }

const pct = (v: number | null, casas = 1) => (v === null ? '—' : `${(v * 100).toFixed(v < 0.1 ? 2 : casas).replace('.', ',')}%`)
const int = (v: number) => v.toLocaleString('pt-BR')
const ENTREGA = new Set(['impressoes', 'cliques'])

export default function FunilPage() {
  const [periodo, setPeriodo] = useState('30')
  const [marcaId, setMarcaId] = useState('')
  const [fonte, setFonte] = useState<Fonte>('anuncios')
  const [campanha, setCampanha] = useState('todas')
  const busca = useMemo(() => intervalo(periodo), [periodo])
  const a = useAnuncios(busca.de, busca.ate)
  const ate = busca.ate
  const de = periodo === 'tudo' ? a.inicio ?? ate : busca.de

  const [pixels, setPixels] = useState<Pixel[]>([])
  const [pixelDias, setPixelDias] = useState<(PixelDia & { pixel_id: string })[]>([])

  // Marca inicial: ?marca=<slug> (link do detalhe da marca) ou a primeira ativa.
  useEffect(() => {
    if (marcaId || !a.marcas.length) return
    const slug = new URLSearchParams(window.location.search).get('marca')
    setMarcaId((a.marcas.find((m) => m.slug === slug) ?? a.marcas.find((m) => m.ativo) ?? a.marcas[0]).id)
  }, [a.marcas, marcaId])

  useEffect(() => {
    const supabase = createClient() as any
    async function load() {
      try {
        const [{ data: p }, dias] = await Promise.all([
          supabase.from('anuncio_pixels').select('pixel_id, nome, marca_id, erro').order('nome'),
          buscarTudo<PixelDia & { pixel_id: string }>((x, y) => supabase.from('anuncio_pixel_eventos_diarios')
            .select('pixel_id, data, evento, quantidade').gte('data', busca.de).lte('data', busca.ate)
            .order('data').order('pixel_id').order('evento').range(x, y)),
        ])
        setPixels(p ?? [])
        setPixelDias(dias)
      } catch {
        setPixels([])
        setPixelDias([])
      }
    }
    load()
  }, [busca.de, busca.ate])

  const marca = a.marcas.find((m) => m.id === marcaId)
  const pixelsDaMarca = useMemo(() => pixels.filter((p) => p.marca_id === marcaId), [pixels, marcaId])

  const r = useMemo(() => {
    if (!marca) return null
    const recorte = a.daMarca(marca.id)
    const porCampanha = fonte === 'anuncios' && campanha !== 'todas'
    const metricas = porCampanha ? recorte.metricas.filter((m) => m.campaign_id === campanha) : recorte.metricas
    const clientes = porCampanha ? recorte.clientes.filter((c) => c.campaign_id === campanha) : recorte.clientes
    const ids = new Set(pixelsDaMarca.map((p) => p.pixel_id))
    const pixel = pixelDias.filter((d) => ids.has(d.pixel_id))

    const campanhas = [...new Map(recorte.metricas.map((m) => [m.campaign_id, a.campanhas.find((c) => c.campaign_id === m.campaign_id)?.nome ?? m.campaign_name ?? m.campaign_id]))]
      .sort((x, y) => x[1].localeCompare(y[1]))

    // Eventos que existem nos dados: ajudam a montar as etapas em Configurações.
    const acoes = new Set<string>()
    for (const m of recorte.metricas) for (const k of Object.keys(m.actions ?? {})) acoes.add(k)

    return {
      etapas: calcularFunil(marca.funil ?? [], fonte, { metricas, pixel, clientes }, de, ate),
      campanhas,
      eventosPixel: [...new Set(pixel.map((p) => p.evento))].sort(),
      acoes: [...acoes].sort(),
    }
  }, [marca, a.daMarca, a.campanhas, fonte, campanha, pixelsDaMarca, pixelDias, de, ate])

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Anúncios" description="Funil por marca" />

      <main className="flex-1 p-4 md:p-6">
        <AnunciosSubNav />
        <PageHeader
          title="Funil"
          description={`${periodo === 'tudo' ? 'Desde o início: ' : ''}${formatDate(de)} a ${formatDate(ate)} · horário de Brasília`}
        >
          <Select value={marcaId} onValueChange={(v) => { setMarcaId(v); setCampanha('todas') }}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>{a.marcas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
          </Select>
          <SeletorPeriodo value={periodo} onChange={setPeriodo} />
        </PageHeader>

        {a.erro && <p className="mb-4 text-sm text-brand-rosa">{a.erro}</p>}

        {a.loading || !r || !marca ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-white/[0.1] p-0.5">
                {([['anuncios', 'Quem veio de anúncio'], ['site', 'Site (todo o tráfego)']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setFonte(v)}
                    className={cn('rounded-md px-3 py-1.5 text-xs', fonte === v ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50')}
                  >{label}</button>
                ))}
              </div>
              {fonte === 'anuncios' && (
                <Select value={campanha} onValueChange={setCampanha}>
                  <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as campanhas</SelectItem>
                    {r.campanhas.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <p className="text-xs text-brand-lavanda/50 max-w-3xl">
              {fonte === 'anuncios'
                ? 'Entrega e eventos do pixel atribuídos aos anúncios pelo Meta; etapas "(real)" vêm do produto e contam só clientes que chegaram por anúncio. Custo = gasto do período ÷ quantidade da etapa.'
                : 'Tudo o que os pixels da marca registraram (anúncio + orgânico + direto). Etapas reais contam todos os clientes da marca. Etapas de entrega (impressões, cliques) não se aplicam.'}
            </p>

            {fonte === 'site' && pixelsDaMarca.length === 0 && (
              <p className="rounded-xl border border-brand-rosa/20 bg-brand-rosa/[0.06] px-4 py-3 text-sm text-brand-lavanda/80">
                Nenhum pixel ligado a {marca.nome}. Ligue em <Link href="/anuncios/configuracoes" className="underline">Configurações → Pixels</Link> (aparecem depois da primeira sincronização).
              </p>
            )}
            {fonte === 'site' && pixelsDaMarca.some((p) => p.erro) && (
              <p className="rounded-xl border border-brand-rosa/20 bg-brand-rosa/[0.06] px-4 py-3 text-sm text-brand-lavanda/80">
                Não foi possível ler as estatísticas de {pixelsDaMarca.filter((p) => p.erro).map((p) => p.nome).join(', ')}. Veja o motivo em Configurações → Pixels.
              </p>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{marca.nome} · {fonte === 'anuncios' ? 'quem veio de anúncio' : 'todo o tráfego'}</CardTitle>
              </CardHeader>
              <CardContent>
                {r.etapas.length === 0 ? (
                  <p className="py-6 text-center text-sm text-brand-lavanda/40">
                    Sem etapas para esta visão. Monte o funil da marca em <Link href="/anuncios/configuracoes" className="underline">Configurações</Link>.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {r.etapas.map((e, i) => <LinhaEtapa key={`${e.evento}-${i}`} etapa={e} primeira={i === 0} mostrarCusto={fonte === 'anuncios'} />)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Eventos encontrados nos dados</CardTitle>
                <p className="text-xs text-brand-lavanda/40">Use estes nomes para montar ou ajustar as etapas da marca em Configurações.</p>
              </CardHeader>
              <CardContent className="grid gap-4 text-xs sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-brand-lavanda/50">Pixel (todo o tráfego)</p>
                  <p className="text-brand-lavanda/80">{r.eventosPixel.length ? r.eventosPixel.join(' · ') : '—'}</p>
                </div>
                <div>
                  <p className="mb-2 text-brand-lavanda/50">Ações atribuídas aos anúncios</p>
                  <p className="break-words text-brand-lavanda/80">{r.acoes.length ? r.acoes.join(' · ') : '—'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

function LinhaEtapa({ etapa: e, primeira, mostrarCusto }: { etapa: EtapaCalculada; primeira: boolean; mostrarCusto: boolean }) {
  return (
    <div className={cn('grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg px-3 py-3 sm:grid-cols-[220px_1fr_auto]', e.lateral ? 'ml-6 bg-white/[0.015]' : 'bg-white/[0.03]')}>
      <div className="flex min-w-0 items-center gap-2">
        {e.lateral && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-brand-lavanda/30" />}
        <div className="min-w-0">
          <p className="truncate text-sm text-brand-lavanda">{e.rotulo}</p>
          <p className="text-[11px] text-brand-lavanda/40">
            {e.lateral ? 'saída alternativa' : primeira ? 'topo do funil' : `${pct(e.doTopo)} do topo`}
          </p>
        </div>
      </div>
      {/* Barra = quanto passou da etapa anterior (não do topo: impressões achatariam tudo). */}
      <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
        {!primeira && (
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-white/[0.06]">
              <div className={cn('h-2 rounded-full', e.lateral ? 'bg-brand-violeta/70' : 'bg-brand-lima')}
                style={{ width: `${Math.min(100, Math.max(e.taxa ? 1.5 : 0, (e.taxa ?? 0) * 100))}%` }} />
            </div>
            <span className="w-24 text-right text-xs tabular-nums text-brand-lavanda/70">{pct(e.taxa)} da anterior</span>
          </div>
        )}
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold tabular-nums text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{int(e.valor)}</p>
        {mostrarCusto && !ENTREGA.has(e.evento) && <p className="text-[11px] tabular-nums text-brand-lavanda/40">{e.custo === null ? '—' : `${formatCurrency(e.custo)} cada`}</p>}
      </div>
    </div>
  )
}

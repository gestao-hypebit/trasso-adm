'use client'

import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AnunciosSubNav } from '@/components/anuncios/anuncios-sub-nav'
import { StatusCampanha } from '@/components/anuncios/tabela-desempenho'
import { intervalo, useAnuncios, type Campanha, type Marca } from '@/components/anuncios/use-anuncios'
import { createClient } from '@/lib/supabase/client'
import { marcaPorPrefixo } from '@/lib/anuncios/regras'
import { formatCurrency } from '@/lib/utils'

// Campanhas que nenhum prefixo reconheceu, para atribuir à mão.
// Atribuição manual vence a automática e a sincronização não mexe nela.
export default function SemMarcaPage() {
  const { de, ate } = useMemo(() => intervalo('90'), [])
  const [recarregar, setRecarregar] = useState(0)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarSemGasto, setMostrarSemGasto] = useState(false)
  const a = useAnuncios(de, ate, recarregar)

  const r = useMemo(() => {
    const gasto = new Map<string, number>()
    for (const m of a.metricas) gasto.set(m.campaign_id, (gasto.get(m.campaign_id) ?? 0) + Number(m.spend))
    const com = (c: Campanha) => ({ ...c, gasto: gasto.get(c.campaign_id) ?? 0 })
    const semMarca = a.campanhas.filter((c) => !c.marca_id && c.origem !== 'manual').map(com).sort((x, y) => y.gasto - x.gasto)
    return {
      comGasto: semMarca.filter((c) => c.gasto > 0),
      semGasto: semMarca.filter((c) => c.gasto === 0),
      manuais: a.campanhas.filter((c) => c.origem === 'manual').map(com).sort((x, y) => y.gasto - x.gasto),
    }
  }, [a.metricas, a.campanhas])

  async function salvar(campaignId: string, marcaId: string | null, origem: 'auto' | 'manual') {
    setSalvando(campaignId)
    setErro(null)
    const { error } = await (createClient() as any).from('anuncio_campanha_marca')
      .upsert({ campaign_id: campaignId, marca_id: marcaId, origem, updated_at: new Date().toISOString() }, { onConflict: 'campaign_id' })
    setSalvando(null)
    if (error) setErro('Não foi possível salvar a atribuição.')
    else setRecarregar((n) => n + 1)
  }

  // Voltar ao automático: aplica o prefixo agora (a próxima sincronização faria o mesmo).
  const voltarAoAutomatico = (c: Campanha) => salvar(c.campaign_id, marcaPorPrefixo(c.nome, a.marcas), 'auto')

  const nomeMarca = (id: string | null) => a.marcas.find((m) => m.id === id)?.nome ?? 'Sem marca'

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Anúncios" description="Campanhas sem marca" />

      <main className="flex-1 p-4 md:p-6">
        <AnunciosSubNav semMarca={r.comGasto.length} />
        <PageHeader
          title="Campanhas sem marca"
          description="O nome não começa com nenhum prefixo de marca. Escolha a marca: a atribuição manual vale para sempre, mesmo se o nome mudar."
        />

        {(a.erro || erro) && <p className="mb-4 text-sm text-brand-rosa">{a.erro ?? erro}</p>}

        {a.loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Com gasto nos últimos 90 dias</CardTitle></CardHeader>
              <CardContent>
                <ListaCampanhas lista={r.comGasto} marcas={a.marcas} salvando={salvando}
                  vazio="Nenhuma campanha com gasto está sem marca. 🎉"
                  onEscolher={(c, marcaId) => salvar(c.campaign_id, marcaId, 'manual')} />
              </CardContent>
            </Card>

            {r.semGasto.length > 0 && (
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">Sem gasto nos últimos 90 dias ({r.semGasto.length})</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setMostrarSemGasto((v) => !v)}>{mostrarSemGasto ? 'Esconder' : 'Mostrar'}</Button>
                </CardHeader>
                {mostrarSemGasto && (
                  <CardContent>
                    <ListaCampanhas lista={r.semGasto} marcas={a.marcas} salvando={salvando} vazio=""
                      onEscolher={(c, marcaId) => salvar(c.campaign_id, marcaId, 'manual')} />
                  </CardContent>
                )}
              </Card>
            )}

            {r.manuais.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Atribuídas manualmente</CardTitle></CardHeader>
                <CardContent className="divide-y divide-white/[0.04]">
                  {r.manuais.map((c) => (
                    <div key={c.campaign_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-brand-lavanda" title={c.nome}>{c.nome}</p>
                        <p className="text-xs text-brand-lavanda/40">{nomeMarca(c.marca_id)} · {formatCurrency(c.gasto)} em 90 dias</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={salvando === c.campaign_id} onClick={() => voltarAoAutomatico(c)}>
                        Voltar ao automático
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function ListaCampanhas({ lista, marcas, salvando, vazio, onEscolher }: {
  lista: (Campanha & { gasto: number })[]
  marcas: Marca[]
  salvando: string | null
  vazio: string
  onEscolher: (c: Campanha, marcaId: string | null) => void
}) {
  if (!lista.length) return <p className="py-6 text-center text-sm text-brand-lavanda/40">{vazio}</p>
  return (
    <div className="divide-y divide-white/[0.04]">
      {lista.map((c) => (
        <div key={c.campaign_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-brand-lavanda" title={c.nome}>{c.nome}</p>
            <div className="flex items-center gap-2">
              <StatusCampanha status={c.effective_status ?? c.status} orcamentoDiario={c.orcamento_diario} orcamentoTotal={c.orcamento_total} />
              <span className="mt-0.5 text-[11px] text-brand-lavanda/40">{formatCurrency(c.gasto)} em 90 dias</span>
            </div>
          </div>
          <Select value="" onValueChange={(v) => onEscolher(c, v === 'nenhuma' ? null : v)} disabled={salvando === c.campaign_id}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Atribuir marca…" /></SelectTrigger>
            <SelectContent>
              {marcas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
              <SelectItem value="nenhuma">Nenhuma (fixar sem marca)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buscarTudo } from '@/lib/anuncios/consulta'
import type { Etapa } from '@/lib/anuncios/funil'
import { clientesDoFunil, diaSP, somarDias, type ClienteFunil, type Evento, type Metrica } from '@/lib/anuncios/regras'

export type Marca = { id: string; nome: string; slug: string; prefixos: string[]; cor: string; ativo: boolean; api_key_criada_em: string | null; funil: Etapa[] }
export type Campanha = {
  campaign_id: string; nome: string; status: string | null; effective_status: string | null
  orcamento_diario: number | null; orcamento_total: number | null
  marca_id: string | null; origem: 'auto' | 'manual' | null
}

// Colunas explícitas: o hash da chave não é legível pelo navegador.
export const COLUNAS_MARCA = 'id, nome, slug, prefixos, cor, ativo, api_key_criada_em, funil'

export const PERIODOS = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: 'mes', label: 'Este mês' },
  { value: 'mes_anterior', label: 'Mês passado' },
  { value: 'tudo', label: 'Desde o início' },
]

// "Desde o início": busca tudo a partir desta data; a tela usa o 1º dia com dado.
export const INICIO_TUDO = '2000-01-01'

// Período em dias de São Paulo, sempre terminando hoje (ou no fim do mês passado).
export function intervalo(periodo: string) {
  const hoje = diaSP(new Date())
  if (periodo === 'mes') return { de: `${hoje.slice(0, 7)}-01`, ate: hoje }
  if (periodo === 'mes_anterior') {
    const fim = somarDias(`${hoje.slice(0, 7)}-01`, -1)
    return { de: `${fim.slice(0, 7)}-01`, ate: fim }
  }
  if (periodo === 'tudo') return { de: INICIO_TUDO, ate: hoje }
  return { de: somarDias(hoje, -(Number(periodo) - 1)), ate: hoje }
}

// Carrega marcas, campanhas (com a marca), métricas do período e o funil.
// O funil vem inteiro: "1ª assinatura" e a origem do cliente dependem do histórico todo.
export function useAnuncios(de: string, ate: string, recarregar = 0) {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    const supabase = createClient() as any
    async function load() {
      setLoading(true)
      try {
        const [{ data: m, error: em }, camps, mapa, met, ev] = await Promise.all([
          supabase.from('anuncio_marcas').select(COLUNAS_MARCA).order('nome'),
          buscarTudo<Omit<Campanha, 'marca_id' | 'origem'>>((a, b) => supabase.from('anuncio_campanhas')
            .select('campaign_id, nome, status, effective_status, orcamento_diario, orcamento_total').range(a, b)),
          buscarTudo<{ campaign_id: string; marca_id: string | null; origem: 'auto' | 'manual' }>((a, b) =>
            supabase.from('anuncio_campanha_marca').select('campaign_id, marca_id, origem').range(a, b)),
          buscarTudo<Metrica>((a, b) => supabase.from('anuncio_metricas_diarias')
            .select('data, campaign_id, ad_id, ad_name, campaign_name, spend, impressions, clicks, inline_link_clicks, actions')
            .gte('data', de).lte('data', ate).order('data').order('ad_id').range(a, b)),
          buscarTudo<Evento>((a, b) => supabase.from('funil_eventos')
            .select('marca_id, tipo, cliente_ref, ocorrido_em, valor, ad_id, campaign_id, de_anuncio')
            .order('ocorrido_em').order('id').range(a, b)),
        ])
        if (em) throw new Error(em.message)
        if (!vivo) return
        const porCampanha = new Map(mapa.map((x) => [x.campaign_id, x]))
        setMarcas((m as Marca[]) ?? [])
        setCampanhas(camps.map((c) => ({ ...c, marca_id: porCampanha.get(c.campaign_id)?.marca_id ?? null, origem: porCampanha.get(c.campaign_id)?.origem ?? null })))
        setMetricas(met)
        setEventos(ev)
        setErro(null)
      } catch {
        if (vivo) setErro('Não foi possível carregar. A migration de anúncios já foi aplicada no Supabase?')
      } finally {
        if (vivo) setLoading(false)
      }
    }
    load()
    return () => { vivo = false }
  }, [de, ate, recarregar])

  const marcaDaCampanha = useMemo(() => new Map(campanhas.map((c) => [c.campaign_id, c.marca_id])), [campanhas])
  const clientes = useMemo<ClienteFunil[]>(() => clientesDoFunil(eventos), [eventos])

  // Primeiro dia com gasto ou evento (para "Desde o início"). Métricas vêm ordenadas por data.
  const inicio = useMemo(() => {
    const dias = [metricas[0]?.data, eventos[0] && diaSP(eventos[0].ocorrido_em)].filter(Boolean) as string[]
    return dias.length ? dias.sort()[0] : null
  }, [metricas, eventos])

  // Recorte por marca (null = campanhas sem marca; o funil delas fica vazio).
  const daMarca = useCallback((marcaId: string | null) => ({
    metricas: metricas.filter((m) => (marcaDaCampanha.get(m.campaign_id) ?? null) === marcaId),
    clientes: marcaId ? clientes.filter((c) => c.marca_id === marcaId) : [],
  }), [metricas, clientes, marcaDaCampanha])

  return { marcas, campanhas, metricas, clientes, inicio, loading, erro, daMarca, marcaDaCampanha }
}

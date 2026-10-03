import 'server-only'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { usuarioLogado } from '@/lib/asaas/auth'
import { IaErro, iaConfigurada } from '@/lib/sites/ia'
import type { Briefing, Conteudo } from '@/lib/sites/tipos'

export type PreviaRow = {
  id: string
  nome: string
  slug: string
  briefing: Briefing
  conteudo: Conteudo | null
  status: string
  html: string | null
  html_parcial: string | null
  versao_atual: number
}

// Checagens comuns das rotas do gerador: usuário logado, IA configurada e prévia existente.
export async function abrirPrevia(id: string): Promise<{ erro: NextResponse } | { supabase: any; previa: PreviaRow }> {
  if (!(await usuarioLogado())) return { erro: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  if (!iaConfigurada()) return { erro: NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 400 }) }
  const supabase = createServiceClient() as any
  const { data, error } = await supabase
    .from('site_previas')
    .select('id, nome, slug, briefing, conteudo, status, html, html_parcial, versao_atual')
    .eq('id', id)
    .maybeSingle()
  if (error) return { erro: NextResponse.json({ error: error.message }, { status: 500 }) }
  if (!data) return { erro: NextResponse.json({ error: 'Prévia não encontrada.' }, { status: 404 }) }
  return { supabase, previa: data }
}

// Grava uma versão nova do HTML e marca como atual. O número segue a maior
// versão existente (a atual pode ser uma antiga restaurada).
export async function salvarVersao(supabase: any, previa: Pick<PreviaRow, 'id'>, html: string, instrucao: string | null) {
  const { data: ultima } = await supabase
    .from('site_previa_versoes')
    .select('numero')
    .eq('previa_id', previa.id)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  const numero = (ultima?.numero ?? 0) + 1
  const { error } = await supabase.from('site_previa_versoes').insert({ previa_id: previa.id, numero, html, instrucao })
  if (error) throw error
  const { error: e2 } = await supabase
    .from('site_previas')
    .update({ html, versao_atual: numero, status: 'pronto', erro: null, updated_at: new Date().toISOString() })
    .eq('id', previa.id)
  if (e2) throw e2
  return numero
}

export function respostaErro(e: unknown, contexto: string) {
  console.error(`[sites] ${contexto}`, e)
  const msg = e instanceof IaErro ? e.message : e instanceof Error ? e.message : 'Falha ao falar com a IA.'
  return NextResponse.json({ error: msg }, { status: e instanceof IaErro ? 422 : 502 })
}

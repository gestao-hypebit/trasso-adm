import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Conteudo, Estrutura } from '@/lib/sites-clientes/conteudo'

export type Versao = { id: string; created_at: string; publicado_por: string | null }

export type DadosEditor = {
  estrutura: Estrutura | null
  estruturaAtualizadaEm: string | null
  rascunho: Conteudo
  publicado: Conteudo | null
  publicadoEm: string | null
  publicadoPor: string | null
  versoes: Versao[]
}

// Chamar só depois de autorizarSite(siteId).
export async function dadosEditor(siteId: string): Promise<DadosEditor> {
  const db = createServiceClient() as any
  const [{ data: c }, { data: v }] = await Promise.all([
    db.from('site_conteudos').select('estrutura, estrutura_atualizada_em, rascunho, publicado, publicado_em, publicado_por').eq('site_id', siteId).maybeSingle(),
    db.from('site_conteudo_versoes').select('id, created_at, publicado_por').eq('site_id', siteId).order('created_at', { ascending: false }).limit(15),
  ])
  return {
    estrutura: c?.estrutura ?? null,
    estruturaAtualizadaEm: c?.estrutura_atualizada_em ?? null,
    rascunho: c?.rascunho ?? {},
    publicado: c?.publicado ?? null,
    publicadoEm: c?.publicado_em ?? null,
    publicadoPor: c?.publicado_por ?? null,
    versoes: (v ?? []) as Versao[],
  }
}

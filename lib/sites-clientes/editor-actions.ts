'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { autorizarSite } from '@/lib/sites-clientes/acesso'
import { igual, limparConteudo, problemasConteudo, validarEstrutura, type Conteudo, type Estrutura } from '@/lib/sites-clientes/conteudo'
import { urlDoSite } from '@/lib/sites-clientes/url'

// Ações do editor de conteúdo. Servem ao administrativo (equipe) e à área do
// cliente: autorizarSite decide quem pode mexer em qual site.

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string }

const SEM_PERMISSAO = 'Você não tem acesso a este site. Entre de novo.'
const BUCKET = 'sites-conteudo'
const TIPOS_IMAGEM: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }

const db = () => createServiceClient() as any

async function estruturaDo(siteId: string): Promise<Estrutura | null> {
  const { data } = await db().from('site_conteudos').select('estrutura').eq('site_id', siteId).maybeSingle()
  return (data?.estrutura as Estrutura | null) ?? null
}

function revalidarTelas(siteId: string) {
  revalidatePath(`/meu-site/${siteId}`)
  revalidatePath(`/sites-clientes/${siteId}/conteudo`)
}

export async function salvarRascunho(siteId: string, valores: Conteudo): Promise<Resultado> {
  const auth = await autorizarSite(siteId)
  if (!auth) return { ok: false, erro: SEM_PERMISSAO }
  const estrutura = await estruturaDo(siteId)
  if (!estrutura) return { ok: false, erro: 'O site ainda não enviou a estrutura de conteúdo.' }

  const { error } = await db().from('site_conteudos').update({
    rascunho: limparConteudo(estrutura, valores),
    updated_at: new Date().toISOString(),
  }).eq('site_id', siteId)
  if (error) return { ok: false, erro: 'Não foi possível salvar.' }
  revalidarTelas(siteId)
  return { ok: true }
}

export async function publicar(siteId: string, valores: Conteudo): Promise<Resultado<{ noAr: boolean }>> {
  const auth = await autorizarSite(siteId)
  if (!auth) return { ok: false, erro: SEM_PERMISSAO }
  const estrutura = await estruturaDo(siteId)
  if (!estrutura) return { ok: false, erro: 'O site ainda não enviou a estrutura de conteúdo.' }

  const conteudo = limparConteudo(estrutura, valores)
  const problemas = problemasConteudo(estrutura, conteudo)
  if (problemas.length > 0) return { ok: false, erro: problemas.join(' ') }

  const agora = new Date().toISOString()
  const autor = `${auth.editor.nome}${auth.editor.tipo === 'equipe' ? ' (Slick)' : ''}`
  const supabase = db()
  const { error } = await supabase.from('site_conteudos').update({
    rascunho: conteudo, publicado: conteudo, publicado_em: agora, publicado_por: autor, updated_at: agora,
  }).eq('site_id', siteId)
  if (error) return { ok: false, erro: 'Não foi possível publicar.' }
  await supabase.from('site_conteudo_versoes').insert({ site_id: siteId, conteudo, publicado_por: autor })

  revalidarTelas(siteId)
  return { ok: true, noAr: await avisarSite(auth.site.dominio, auth.site.chave_hash) }
}

// Pede ao site para buscar o conteúdo novo agora. Se falhar, o site pega
// sozinho no próximo ciclo de cache (ver docs/sites-clientes.md).
async function avisarSite(dominio: string | null, chaveHash: string | null) {
  if (!dominio || !chaveHash) return false
  try {
    const res = await fetch(`${urlDoSite(dominio)}/api/slick/revalidar`, {
      method: 'POST',
      headers: { 'x-slick-assinatura': chaveHash },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('[conteudo] revalidar', dominio, res.status)
    return res.ok
  } catch (e) {
    console.error('[conteudo] revalidar', dominio, e)
    return false
  }
}

export async function descartarRascunho(siteId: string): Promise<Resultado<{ conteudo: Conteudo }>> {
  const auth = await autorizarSite(siteId)
  if (!auth) return { ok: false, erro: SEM_PERMISSAO }
  const supabase = db()
  const { data } = await supabase.from('site_conteudos').select('publicado').eq('site_id', siteId).maybeSingle()
  const conteudo = (data?.publicado as Conteudo | null) ?? {}
  const { error } = await supabase.from('site_conteudos').update({ rascunho: conteudo, updated_at: new Date().toISOString() }).eq('site_id', siteId)
  if (error) return { ok: false, erro: 'Não foi possível descartar.' }
  revalidarTelas(siteId)
  return { ok: true, conteudo }
}

export async function restaurarVersao(siteId: string, versaoId: string): Promise<Resultado<{ conteudo: Conteudo }>> {
  const auth = await autorizarSite(siteId)
  if (!auth) return { ok: false, erro: SEM_PERMISSAO }
  const supabase = db()
  const [{ data: versao }, estrutura] = await Promise.all([
    supabase.from('site_conteudo_versoes').select('conteudo').eq('id', versaoId).eq('site_id', siteId).maybeSingle(),
    estruturaDo(siteId),
  ])
  if (!versao || !estrutura) return { ok: false, erro: 'Versão não encontrada.' }
  const conteudo = limparConteudo(estrutura, versao.conteudo)
  const { error } = await supabase.from('site_conteudos').update({ rascunho: conteudo, updated_at: new Date().toISOString() }).eq('site_id', siteId)
  if (error) return { ok: false, erro: 'Não foi possível restaurar.' }
  revalidarTelas(siteId)
  return { ok: true, conteudo }
}

// URL assinada para o navegador enviar a imagem direto ao Storage.
export async function prepararUpload(siteId: string, tipo: string, tamanho: number): Promise<Resultado<{ path: string; token: string; url: string }>> {
  const auth = await autorizarSite(siteId)
  if (!auth) return { ok: false, erro: SEM_PERMISSAO }
  const ext = TIPOS_IMAGEM[tipo]
  if (!ext) return { ok: false, erro: 'Envie uma imagem JPG, PNG, WEBP ou AVIF.' }
  if (tamanho > 5 * 1024 * 1024) return { ok: false, erro: 'A imagem passa de 5 MB. Diminua e tente de novo.' }

  const path = `${siteId}/${crypto.randomUUID()}.${ext}`
  const storage = db().storage.from(BUCKET)
  const { data, error } = await storage.createSignedUploadUrl(path)
  if (error || !data) return { ok: false, erro: 'Não foi possível preparar o envio. A migration do editor já foi aplicada?' }
  const { data: pub } = storage.getPublicUrl(path)
  return { ok: true, path, token: data.token, url: pub.publicUrl }
}

// Busca a estrutura (seções e campos) no próprio site e guarda.
export async function sincronizarEstrutura(siteId: string): Promise<Resultado<{ secoes: number }>> {
  const auth = await autorizarSite(siteId)
  if (!auth) return { ok: false, erro: SEM_PERMISSAO }
  if (!auth.site.dominio) return { ok: false, erro: 'Cadastre o domínio do site primeiro.' }

  let estrutura: Estrutura
  try {
    const res = await fetch(`${urlDoSite(auth.site.dominio)}/api/slick/schema`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return { ok: false, erro: `O site respondeu ${res.status} em /api/slick/schema. Ele já tem o editor ligado?` }
    estrutura = validarEstrutura(await res.json())
  } catch (e) {
    return { ok: false, erro: e instanceof Error && !(e.name === 'TimeoutError') ? `Estrutura do site com problema: ${e.message}` : 'Não foi possível falar com o site.' }
  }

  const supabase = db()
  const agora = new Date().toISOString()
  const { data: atual } = await supabase.from('site_conteudos').select('site_id, estrutura, rascunho, publicado').eq('site_id', siteId).maybeSingle()
  if (atual) {
    if (!igual(atual.estrutura, estrutura)) {
      // Campos que saíram da estrutura somem do rascunho; o publicado fica como está até a próxima publicação.
      await supabase.from('site_conteudos').update({
        estrutura, estrutura_atualizada_em: agora, rascunho: limparConteudo(estrutura, atual.rascunho), updated_at: agora,
      }).eq('site_id', siteId)
    }
  } else {
    const { error } = await supabase.from('site_conteudos').insert({ site_id: siteId, estrutura, estrutura_atualizada_em: agora })
    if (error) return { ok: false, erro: 'Não foi possível guardar a estrutura. A migration do editor já foi aplicada?' }
  }
  revalidarTelas(siteId)
  return { ok: true, secoes: estrutura.secoes.length }
}

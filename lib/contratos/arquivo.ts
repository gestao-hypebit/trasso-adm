import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'contratos'

// Envia o PDF assinado para o bucket privado e grava o caminho no contrato.
export async function enviarContratoAssinado(supabase: SupabaseClient, contratoId: string, file: File): Promise<string> {
  if (file.type !== 'application/pdf') throw new Error('Envie um arquivo PDF.')
  if (file.size > 20 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 20 MB.')
  const path = `${contratoId}/assinado-${Date.now()}.pdf`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  const { error: errUpdate } = await (supabase as any).from('contratos').update({ arquivo_url: path }).eq('id', contratoId)
  if (errUpdate) throw errUpdate
  return path
}

// arquivo_url pode ser uma URL completa (legado) ou um caminho no bucket privado.
export async function urlArquivoContrato(supabase: SupabaseClient, arquivoUrl: string): Promise<string | null> {
  if (/^https?:\/\//.test(arquivoUrl)) return arquivoUrl
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(arquivoUrl, 60 * 10)
  return data?.signedUrl ?? null
}

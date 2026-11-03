'use server'

import { revalidatePath } from 'next/cache'
import { siteDaCopy } from '@/lib/sites-clientes/copy-link'
import { aprovarRestanteCopy, responderSecaoCopy, type RespostaCopy, type ResultadoCopy } from '@/lib/sites-clientes/copy-respostas'

// Respostas pelo link só da copy (/copy/<token>). O token vale para um site só.

const ERRO_LINK = 'Link inválido ou expirado.'

export async function responderCopyLink(token: string, secaoId: string, resposta: RespostaCopy): Promise<ResultadoCopy> {
  const site = await siteDaCopy(token)
  if (!site) return { success: false, error: ERRO_LINK }
  const r = await responderSecaoCopy(site, secaoId, resposta)
  if (r.success) revalidatePath(`/copy/${token}`)
  return r
}

export async function aprovarRestanteLink(token: string, siteId: string, nome: string): Promise<ResultadoCopy> {
  const site = await siteDaCopy(token)
  if (!site || site.id !== siteId) return { success: false, error: ERRO_LINK }
  const r = await aprovarRestanteCopy(site, nome)
  if (r.success) revalidatePath(`/copy/${token}`)
  return r
}

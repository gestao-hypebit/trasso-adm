import 'server-only'
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Site do link só da copy (/copy/<token>). Site desativado tira o link do ar.
export const siteDaCopy = cache(async (token: string) => {
  if (!UUID_RE.test(token)) return null
  const { data } = await (createServiceClient() as any)
    .from('sites_clientes')
    .select('id, nome, ativo, clientes(nome, empresa)')
    .eq('copy_token', token)
    .maybeSingle()
  if (!data || !data.ativo) return null
  return {
    id: data.id as string,
    nome: data.nome as string,
    clienteNome: (data.clientes?.empresa || data.clientes?.nome || null) as string | null,
  }
})

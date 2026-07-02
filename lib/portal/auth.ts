import 'server-only'
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/types/database.types'

export type PortalCliente = Database['public']['Tables']['clientes']['Row']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const getClienteByToken = cache(async (token: string): Promise<PortalCliente | null> => {
  if (!UUID_RE.test(token)) return null
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('clientes')
    .select('*')
    .eq('portal_token', token)
    .eq('portal_ativo', true)
    .maybeSingle()
  return data
})

export async function registrarAcessoPortal(clienteId: string) {
  const supabase = createServiceClient() as any
  await supabase.from('clientes').update({ portal_last_accessed_at: new Date().toISOString() }).eq('id', clienteId)
}

import 'server-only'
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Planejamento aberto pelo link do cliente (/plano/<token>). Link desligado = não existe.
export const getPlanejamentoPorToken = cache(async (token: string) => {
  if (!UUID_RE.test(token)) return null
  const supabase = createServiceClient() as any
  const { data } = await supabase
    .from('social_planejamentos')
    .select('id, mes, objetivo, status, link_ativo, clientes(nome, empresa)')
    .eq('token', token)
    .maybeSingle()
  if (!data || !data.link_ativo) return null
  return {
    id: data.id as string,
    mes: data.mes as string,
    objetivo: data.objetivo as string | null,
    status: data.status as string,
    clienteNome: (data.clientes?.empresa || data.clientes?.nome || 'Cliente') as string,
    contatoNome: (data.clientes?.nome ?? '') as string,
  }
})

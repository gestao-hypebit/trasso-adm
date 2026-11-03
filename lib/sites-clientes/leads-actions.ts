'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { autorizarSite } from '@/lib/sites-clientes/acesso'
import { SITE_LEAD_STATUS, type SiteLeadStatus } from '@/lib/sites-clientes/leads'

export async function mudarStatusSiteLead(leadId: string, status: SiteLeadStatus): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!SITE_LEAD_STATUS.includes(status) || !/^[0-9a-f-]{36}$/i.test(leadId)) return { ok: false, erro: 'Status inválido.' }
  const db = createServiceClient() as any
  const { data: lead } = await db.from('site_leads').select('site_id').eq('id', leadId).maybeSingle()
  if (!lead || !(await autorizarSite(lead.site_id, 'cliente'))) return { ok: false, erro: 'Você não tem acesso a este contato.' }
  const { error } = await db.from('site_leads').update({ status, updated_at: new Date().toISOString() }).eq('id', leadId)
  return error ? { ok: false, erro: 'Não foi possível alterar.' } : { ok: true }
}

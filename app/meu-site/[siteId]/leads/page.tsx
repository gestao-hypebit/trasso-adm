import { notFound } from 'next/navigation'
import { autorizarSite } from '@/lib/sites-clientes/acesso'
import { createServiceClient } from '@/lib/supabase/service'
import { SITE_LEAD_SELECT, type SiteLead } from '@/lib/sites-clientes/leads'
import { LeadsCliente } from './leads-cliente'

export default async function LeadsClientePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await autorizarSite(siteId, 'cliente')
  if (!auth) notFound()

  const { data } = await (createServiceClient() as any)
    .from('site_leads').select(SITE_LEAD_SELECT).eq('site_id', siteId).order('created_at', { ascending: false }).limit(500)

  return <LeadsCliente leads={(data ?? []) as SiteLead[]} />
}

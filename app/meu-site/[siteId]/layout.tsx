import { notFound, redirect } from 'next/navigation'
import { autorizarSite } from '@/lib/sites-clientes/acesso'
import { createServiceClient } from '@/lib/supabase/service'
import { urlDoSite } from '@/lib/sites-clientes/url'
import { AbasSite } from './abas'

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await autorizarSite(siteId, 'cliente')
  if (!auth) notFound()
  if (auth.editor.tipo !== 'cliente') redirect(`/sites-clientes/${siteId}/conteudo`)

  const { count } = await (createServiceClient() as any)
    .from('site_leads').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'novo')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{auth.site.nome}</h1>
        {auth.site.dominio && (
          <a href={urlDoSite(auth.site.dominio)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-brand-lavanda/45 hover:text-brand-lavanda">{auth.site.dominio}</a>
        )}
      </div>
      <AbasSite siteId={siteId} leadsNovos={count ?? 0} />
      {children}
    </div>
  )
}

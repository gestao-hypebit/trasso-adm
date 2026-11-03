import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { siteDaCopy } from '@/lib/sites-clientes/copy-link'
import { COPY_SECAO_SELECT, type CopySecao } from '@/lib/sites-clientes/copy'
import { CopySite } from '@/components/portal/copy-site'
import { aprovarRestanteLink, responderCopyLink } from './actions'

// Link só da copy: o cliente vê e aprova os textos do site, e mais nada.

export const metadata: Metadata = {
  title: 'Copy do site — Slick',
  robots: { index: false, follow: false },
}

export default async function CopyLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const site = await siteDaCopy(token)
  if (!site) notFound()

  const db = createServiceClient() as any
  const [{ data: secoes }, { data: config }] = await Promise.all([
    db.from('site_copy_secoes').select(COPY_SECAO_SELECT).eq('site_id', site.id).neq('status', 'rascunho').order('ordem'),
    db.from('configuracoes_agencia').select('nome').maybeSingle(),
  ])
  const lista = (secoes ?? []) as CopySecao[]
  const agencia = (config?.nome as string | undefined) || 'Slick'

  return (
    <div className="min-h-screen bg-brand-noite">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-brand-noite/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-lima text-sm font-black text-brand-noite">{agencia[0]?.toUpperCase()}</div>
            <div>
              <p className="text-sm font-bold leading-none text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{agencia.toLowerCase()}</p>
              <p className="mt-0.5 text-[10px] leading-none text-brand-lavanda/40">Aprovação de copy</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium leading-none text-brand-lavanda">{site.nome}</p>
            {site.clienteNome && <p className="mt-1 text-xs text-brand-lavanda/40">{site.clienteNome}</p>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">
        {lista.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-10 text-center text-sm text-brand-lavanda/50">
            A copy ainda não foi enviada para revisão. Assim que estiver pronta, ela aparece aqui neste mesmo link.
          </p>
        ) : (
          <CopySite
            sites={[{ id: site.id, nome: site.nome, secoes: lista }]}
            acoes={{ responder: responderCopyLink.bind(null, token), aprovarRestante: aprovarRestanteLink.bind(null, token) }}
          />
        )}
      </main>
    </div>
  )
}

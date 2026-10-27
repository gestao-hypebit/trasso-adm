import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { getBriefingPorToken } from '@/lib/social/publico'
import { BriefingFormulario, BriefingObrigado, BriefingTopo } from '@/components/social/briefing-formulario'

export const metadata: Metadata = {
  title: 'Briefing — Slick',
  robots: { index: false, follow: false },
}

// Link que vai para o cliente pelo WhatsApp: ele responde o briefing sem login.
export default async function BriefingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [briefing, { data: config }] = await Promise.all([
    getBriefingPorToken(token),
    (createServiceClient() as any).from('configuracoes_agencia').select('nome, logo_url').limit(1).maybeSingle(),
  ])
  const agencia = { nome: (config?.nome as string) ?? 'Slick', logoUrl: (config?.logo_url as string | null) ?? null }

  if (!briefing) {
    return (
      <div className="min-h-screen bg-brand-noite">
        <BriefingTopo {...agencia} />
        <div className="mx-auto max-w-md px-5 py-20 text-center">
          <p className="mb-2 text-xl font-semibold text-brand-lavanda">Link não encontrado</p>
          <p className="text-brand-lavanda/60">Confira se o link está completo ou fale com a {agencia.nome} para receber um novo.</p>
        </div>
      </div>
    )
  }

  if (briefing.status === 'respondido') return <BriefingObrigado {...agencia} />

  return <BriefingFormulario token={token} modelo={briefing.modelo} contatoNome={briefing.contatoNome} {...agencia} />
}

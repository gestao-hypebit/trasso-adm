import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Globe } from 'lucide-react'
import { getClienteLogado } from '@/lib/cliente-auth/sessao'
import { createServiceClient } from '@/lib/supabase/service'

export default async function MeuSitePage() {
  const cliente = await getClienteLogado()
  if (!cliente) redirect('/entrar')

  const { data } = await (createServiceClient() as any)
    .from('sites_clientes')
    .select('id, nome, dominio')
    .eq('cliente_id', cliente.clienteId)
    .eq('ativo', true)
    .order('created_at')
  const sites = (data ?? []) as { id: string; nome: string; dominio: string | null }[]

  if (sites.length === 1) redirect(`/meu-site/${sites[0].id}`)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Seus sites</h1>
      {sites.length === 0 ? (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-brand-lavanda/50">
          Ainda não há site liberado para edição na sua conta. Fale com a equipe da Slick.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sites.map((s) => (
            <Link key={s.id} href={`/meu-site/${s.id}`} className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.16]">
              <Globe className="h-5 w-5 text-brand-lavanda/40" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-brand-lavanda">{s.nome}</p>
                {s.dominio && <p className="truncate font-mono text-xs text-brand-lavanda/45">{s.dominio}</p>}
              </div>
              <ChevronRight className="h-5 w-5 text-brand-lavanda/30" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

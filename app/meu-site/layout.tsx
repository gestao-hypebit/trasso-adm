import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FolderOpen, LogOut } from 'lucide-react'
import { getClienteLogado } from '@/lib/cliente-auth/sessao'
import { sair } from '@/app/entrar/actions'

export const metadata: Metadata = {
  title: 'Meu site — Slick',
  robots: { index: false, follow: false },
}

export default async function MeuSiteLayout({ children }: { children: React.ReactNode }) {
  const cliente = await getClienteLogado()
  if (!cliente) redirect('/entrar')

  return (
    <div className="min-h-screen bg-brand-noite">
      <header className="border-b border-white/[0.06] bg-brand-noite/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 md:px-6">
          <Link href="/meu-site" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-lima text-sm font-black text-brand-noite">S</div>
            <div>
              <p className="text-sm font-bold leading-none text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>slick</p>
              <p className="mt-0.5 text-[10px] leading-none text-brand-lavanda/40">Área do cliente</p>
            </div>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            {cliente.portalToken && (
              <Link href={`/portal/${cliente.portalToken}`} className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-brand-lavanda/55 hover:bg-white/[0.04] hover:text-brand-lavanda sm:flex">
                <FolderOpen className="h-3.5 w-3.5" /> Projetos e propostas
              </Link>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none text-brand-lavanda">{cliente.nome || cliente.clienteNome}</p>
              <p className="mt-1 text-[11px] text-brand-lavanda/40">{cliente.clienteEmpresa || cliente.email}</p>
            </div>
            <form action={sair}>
              <button type="submit" title="Sair" aria-label="Sair" className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-lavanda/40 hover:bg-white/[0.05] hover:text-brand-lavanda">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</main>
    </div>
  )
}

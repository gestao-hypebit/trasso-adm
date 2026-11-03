import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getClienteLogado } from '@/lib/cliente-auth/sessao'
import { FormEntrar } from './form-entrar'

export const metadata: Metadata = {
  title: 'Área do cliente — Slick',
  robots: { index: false, follow: false },
}

export default async function EntrarPage() {
  if (await getClienteLogado()) redirect('/meu-site')

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div aria-hidden className="pointer-events-none fixed left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-brand-violeta/15 blur-[140px]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-lima text-sm font-black text-brand-noite">S</div>
          <div>
            <p className="text-base font-bold leading-none text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>slick</p>
            <p className="mt-1 text-[11px] leading-none text-brand-lavanda/40">Área do cliente</p>
          </div>
        </div>
        <FormEntrar />
      </div>
    </div>
  )
}

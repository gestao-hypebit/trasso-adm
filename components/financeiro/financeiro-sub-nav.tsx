'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export const financeiroSubNav = [
  { href: '/financeiro', label: 'Visão Geral' },
  { href: '/financeiro/receitas', label: 'Receitas' },
  { href: '/financeiro/despesas', label: 'Despesas' },
  { href: '/financeiro/fluxo-de-caixa', label: 'Fluxo de Caixa' },
  { href: '/financeiro/comissoes', label: 'Comissões' },
]

export function FinanceiroSubNav({ pathname }: { pathname: string }) {
  return (
    <div className="flex gap-1 border-b border-white/[0.06] mb-6">
      {financeiroSubNav.map(({ href, label }) => (
        <Link key={href} href={href} className={cn(
          'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
          pathname === href ? 'border-brand-lima text-brand-lima' : 'border-transparent text-brand-lavanda/60 hover:text-brand-lavanda hover:border-white/[0.12]'
        )}>{label}</Link>
      ))}
    </div>
  )
}

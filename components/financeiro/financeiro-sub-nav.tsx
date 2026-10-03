'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export const financeiroSubNav = [
  { href: '/financeiro', label: 'Visão Geral' },
  { href: '/financeiro/receitas', label: 'Contas a Receber' },
  { href: '/financeiro/despesas', label: 'Contas a Pagar' },
  { href: '/financeiro/fluxo-de-caixa', label: 'Fluxo de Caixa' },
  { href: '/financeiro/mrr', label: 'MRR e assinaturas' },
]

export function FinanceiroSubNav({ pathname }: { pathname: string }) {
  return (
    <div className="flex gap-1 border-b border-white/[0.06] mb-6 overflow-x-auto">
      {financeiroSubNav.map(({ href, label }) => (
        <Link key={href} href={href} className={cn(
          'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
          pathname === href ? 'border-brand-lima text-brand-lima' : 'border-transparent text-brand-lavanda/60 hover:text-brand-lavanda hover:border-white/[0.12]'
        )}>{label}</Link>
      ))}
    </div>
  )
}

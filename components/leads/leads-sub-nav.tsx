'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const itens = [
  { href: '/leads', label: 'Funil' },
  { href: '/leads/conversao', label: 'Conversão' },
  { href: '/leads/formularios', label: 'Formulários' },
]

export function LeadsSubNav() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 border-b border-white/[0.06] mb-6 overflow-x-auto">
      {itens.map(({ href, label }) => {
        const ativo = href === '/leads' ? pathname === href : pathname.startsWith(href)
        return (
          <Link key={href} href={href} className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
            ativo ? 'border-brand-lima text-brand-lima' : 'border-transparent text-brand-lavanda/60 hover:text-brand-lavanda hover:border-white/[0.12]'
          )}>{label}</Link>
        )
      })}
    </div>
  )
}

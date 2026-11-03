'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AbasSite({ siteId, leadsNovos }: { siteId: string; leadsNovos: number }) {
  const pathname = usePathname()
  const abas = [
    { href: `/meu-site/${siteId}`, label: 'Conteúdo do site', icon: PenLine },
    { href: `/meu-site/${siteId}/leads`, label: 'Contatos', icon: Inbox, badge: leadsNovos },
  ]
  return (
    <nav className="flex gap-1 border-b border-white/[0.06]">
      {abas.map(({ href, label, icon: Icon, badge }) => {
        const ativo = pathname === href
        return (
          <Link key={href} href={href} className={cn(
            '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors',
            ativo ? 'border-brand-lima text-brand-lavanda' : 'border-transparent text-brand-lavanda/50 hover:text-brand-lavanda/80',
          )}>
            <Icon className="h-4 w-4" /> {label}
            {!!badge && <span className="rounded-full bg-brand-lima px-1.5 text-[10px] font-bold leading-4 text-brand-noite">{badge}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

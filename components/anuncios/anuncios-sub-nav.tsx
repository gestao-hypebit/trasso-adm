'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PERIODOS } from '@/components/anuncios/use-anuncios'

const itens = [
  { href: '/anuncios', label: 'Visão geral' },
  { href: '/anuncios/sem-marca', label: 'Campanhas sem marca' },
  { href: '/anuncios/configuracoes', label: 'Configurações' },
]

export function AnunciosSubNav({ semMarca = 0 }: { semMarca?: number }) {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 border-b border-white/[0.06] mb-6 overflow-x-auto">
      {itens.map(({ href, label }) => {
        const ativo = href === '/anuncios' ? pathname === href || /^\/anuncios\/(?!sem-marca|configuracoes)/.test(pathname) : pathname.startsWith(href)
        return (
          <Link key={href} href={href} className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
            ativo ? 'border-brand-lima text-brand-lima' : 'border-transparent text-brand-lavanda/60 hover:text-brand-lavanda hover:border-white/[0.12]'
          )}>
            {label}
            {href === '/anuncios/sem-marca' && semMarca > 0 && (
              <span className="rounded-full bg-brand-rosa px-1.5 text-[10px] font-bold leading-4 text-brand-lavanda">{semMarca}</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

export function SeletorPeriodo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg border border-white/[0.1] p-0.5 overflow-x-auto">
      {PERIODOS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn('whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs', value === p.value ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50')}
        >{p.label}</button>
      ))}
    </div>
  )
}

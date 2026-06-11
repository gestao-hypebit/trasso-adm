'use client'

import { Bell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface HeaderProps {
  title?: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-white/[0.06] bg-brand-noite/95 backdrop-blur-sm px-6">
      <div className="flex-1">
        {title && (
          <div>
            <h1 className="text-lg font-semibold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{title}</h1>
            {description && <p className="text-xs text-brand-lavanda/50">{description}</p>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
          <Input className="pl-9 w-64 h-9 text-sm" placeholder="Buscar..." />
        </div>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-lima" />
        </Button>
      </div>
    </header>
  )
}

'use client'

import { Bell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCommandPalette } from '@/components/layout/command-palette'

interface HeaderProps {
  title?: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  const { open } = useCommandPalette()

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
        <button
          onClick={open}
          className="hidden md:flex items-center gap-2 h-9 w-64 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-brand-lavanda/40 hover:border-white/[0.16] hover:text-brand-lavanda/60 transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-white/[0.1] text-brand-lavanda/30">Ctrl K</kbd>
        </button>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-lima" />
        </Button>
      </div>
    </header>
  )
}

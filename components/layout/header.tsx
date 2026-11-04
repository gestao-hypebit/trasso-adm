'use client'

import { Search, Menu } from 'lucide-react'
import { IndicadoresTopo } from '@/components/layout/indicadores'
import { NotificacoesMenu } from '@/components/layout/notificacoes-menu'
import { useCommandPalette } from '@/components/layout/command-palette'
import { useMobileNav } from '@/components/layout/mobile-nav'

interface HeaderProps {
  title?: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  const { open } = useCommandPalette()
  const { abrir } = useMobileNav()

  return (
    // Abaixo de lg os indicadores descem para uma segunda linha, em toda a largura.
    <header className="sticky top-0 z-30 flex shrink-0 flex-wrap items-center gap-x-3 md:gap-x-4 border-b border-white/[0.06] bg-brand-noite/95 backdrop-blur-sm px-4 md:px-6 pb-2 lg:h-14 lg:flex-nowrap lg:pb-0">
      <button
        type="button"
        onClick={abrir}
        aria-label="Abrir menu"
        className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-lavanda/70 hover:bg-white/[0.06] hover:text-brand-lavanda md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex h-14 flex-1 min-w-0 items-center">
        {title && (
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base md:text-lg font-semibold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-rosa" />
              <span className="truncate">{title}</span>
            </h1>
            {description && <p className="truncate pl-3.5 text-xs text-brand-lavanda/50">{description}</p>}
          </div>
        )}
      </div>
      <IndicadoresTopo className="order-last w-full lg:order-none lg:w-auto lg:shrink-0" />
      <div className="flex items-center gap-1 md:gap-2">
        <button
          type="button"
          onClick={open}
          aria-label="Buscar"
          className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg text-brand-lavanda/60 hover:bg-white/[0.06] hover:text-brand-lavanda"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          onClick={open}
          className="hidden md:flex items-center gap-2 h-9 w-64 lg:w-40 xl:w-64 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-brand-lavanda/40 hover:border-white/[0.16] hover:text-brand-lavanda/60 transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="lg:hidden xl:inline text-[10px] px-1.5 py-0.5 rounded border border-white/[0.1] text-brand-lavanda/30">Ctrl K</kbd>
        </button>
        <NotificacoesMenu />
      </div>
    </header>
  )
}

'use client'

import * as Popover from '@radix-ui/react-popover'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// Ícone ⓘ que explica um número ou termo. Abre no clique/toque (funciona no celular,
// ao contrário do title).
export function InfoDica({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Popover.Root>
      {/* O span segura o clique depois que o Radix já abriu: dentro de um card com link, não navega. */}
      <span className="inline-flex" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="O que é isso?"
          className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-brand-lavanda/30 hover:text-brand-lavanda/70', className)}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>
      </span>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onClick={(e) => e.stopPropagation()}
          className="z-50 max-w-[280px] rounded-lg border border-white/[0.1] bg-[#141318] px-3 py-2 text-xs leading-relaxed text-brand-lavanda/80 shadow-xl"
        >
          {children}
          <Popover.Arrow className="fill-[#141318]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Carregando em linha (gráficos, cards pequenos). Para listas e telas, use SkeletonLista.
export function Carregando({ texto = 'Carregando…', className }: { texto?: string; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center justify-center gap-2 text-xs text-brand-lavanda/40', className)}>
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {texto}
    </span>
  )
}

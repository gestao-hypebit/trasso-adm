import { cn } from '@/lib/utils'

// Bloco cinza pulsando no lugar do conteúdo enquanto carrega.
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-white/[0.06]', className)} />
}

// Lista genérica carregando (linhas de tabela, itens de lista).
export function SkeletonLista({ linhas = 5, className }: { linhas?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.04] p-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

// Linha de cards de número carregando.
export function SkeletonCards({ quantidade = 4, className }: { quantidade?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)} role="status" aria-label="Carregando">
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
          <Skeleton className="h-2.5 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      ))}
    </div>
  )
}

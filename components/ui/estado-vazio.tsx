import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Acao = { label: string; href?: string; onClick?: () => void; icon?: LucideIcon }

// Tela/lista vazia: diz o que é e já oferece o próximo passo.
export function EstadoVazio({ icone: Icone, titulo, texto, acao, className }: {
  icone?: LucideIcon
  titulo: string
  texto?: string
  acao?: Acao
  className?: string
}) {
  const AcaoIcone = acao?.icon
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icone && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04]">
          <Icone className="h-5 w-5 text-brand-lavanda/40" />
        </div>
      )}
      <p className="text-sm font-medium text-brand-lavanda/80">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-xs text-brand-lavanda/40">{texto}</p>}
      {acao && (
        <Button size="sm" variant="violeta" className="mt-4" onClick={acao.onClick} asChild={!!acao.href}>
          {acao.href
            ? <Link href={acao.href}>{AcaoIcone && <AcaoIcone className="h-3.5 w-3.5" />} {acao.label}</Link>
            : <>{AcaoIcone && <AcaoIcone className="h-3.5 w-3.5" />} {acao.label}</>}
        </Button>
      )}
    </div>
  )
}

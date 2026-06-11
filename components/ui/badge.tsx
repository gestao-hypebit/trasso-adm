import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
  {
    variants: {
      variant: {
        default:   'bg-white/[0.06] text-brand-lavanda/70',
        ativo:     'bg-brand-lima/10 text-brand-lima',
        inativo:   'bg-white/[0.05] text-brand-lavanda/40',
        lead:      'bg-brand-violeta/15 text-brand-violeta/90',
        urgente:   'bg-brand-rosa/10 text-brand-rosa',
        aprovada:  'bg-brand-lima/10 text-brand-lima',
        recusada:  'bg-brand-rosa/10 text-brand-rosa',
        pendente:  'bg-yellow-500/10 text-yellow-400',
        concluido: 'bg-brand-lima/10 text-brand-lima',
        outline:   'border border-white/[0.12] text-brand-lavanda/60',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

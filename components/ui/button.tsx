import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 cursor-pointer',
  {
    variants: {
      variant: {
        default:     'bg-brand-lima text-brand-noite hover:bg-brand-limaClaro font-semibold',
        violeta:     'bg-brand-violeta/90 text-white hover:bg-brand-violeta',
        outline:     'border border-white/[0.12] text-brand-lavanda/80 hover:bg-white/[0.05] hover:text-brand-lavanda',
        ghost:       'text-brand-lavanda/60 hover:text-brand-lavanda hover:bg-white/[0.05]',
        destructive: 'bg-brand-rosa/10 text-brand-rosa border border-brand-rosa/20 hover:bg-brand-rosa/20',
        link:        'text-brand-lavanda/70 underline-offset-4 hover:text-brand-lavanda hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 rounded-md px-3 text-xs',
        lg:      'h-11 rounded-xl px-6 text-sm',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }

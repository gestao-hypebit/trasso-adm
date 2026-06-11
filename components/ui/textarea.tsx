import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-brand-lavanda placeholder:text-brand-lavanda/30 focus:outline-none focus:ring-1 focus:ring-brand-violeta/60 focus:border-brand-violeta/60 disabled:cursor-not-allowed disabled:opacity-40 resize-none transition-colors',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

export { Textarea }

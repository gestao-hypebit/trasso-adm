import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onWheel, ...props }, ref) => (
    <input
      type={type}
      onWheel={
        type === 'number'
          ? (e) => {
              onWheel?.(e)
              e.currentTarget.blur()
            }
          : onWheel
      }
      className={cn(
        'flex h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-brand-lavanda placeholder:text-brand-lavanda/30 focus:outline-none focus:ring-1 focus:ring-brand-lima/40 focus:border-brand-lima/40 disabled:cursor-not-allowed disabled:opacity-40 transition-colors',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export { Input }

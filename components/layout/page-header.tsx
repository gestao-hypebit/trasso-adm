import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, className, children }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5 md:mb-6', className)}>
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          {title}
        </h1>
        {description && <p className="text-sm text-brand-lavanda/60 mt-1">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

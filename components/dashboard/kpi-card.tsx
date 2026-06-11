import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string
  change?: number
  changeLabel?: string
  icon: LucideIcon
  iconColor?: string
}

export function KpiCard({ title, value, change, changeLabel, icon: Icon, iconColor = 'text-brand-lavanda/40' }: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-brand-lavanda/40 mb-3">{title}</p>
            <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {value}
            </p>
            {change !== undefined && (
              <div className={cn('flex items-center gap-1 mt-2 text-xs', isPositive ? 'text-brand-lima' : 'text-brand-rosa')}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isPositive ? '+' : ''}{change}%
                {changeLabel && <span className="text-brand-lavanda/30 font-normal ml-1">{changeLabel}</span>}
              </div>
            )}
          </div>
          <Icon className={cn('h-5 w-5 shrink-0', iconColor)} />
        </div>
      </CardContent>
    </Card>
  )
}

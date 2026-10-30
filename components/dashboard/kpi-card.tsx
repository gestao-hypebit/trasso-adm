import Link from 'next/link'
import { ChevronRight, LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { InfoDica } from '@/components/ui/info-dica'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string
  change?: number
  changeLabel?: string
  icon: LucideIcon
  iconColor?: string
  // Linha extra embaixo do valor (ex.: "39 em dia · 2 inadimplentes").
  sub?: React.ReactNode
  // Clicar no card leva para a lista por trás do número.
  href?: string
  // Explicação do número, no ícone ⓘ ao lado do título.
  info?: React.ReactNode
  // Enquanto carrega, mostra blocos cinza no lugar do número.
  carregando?: boolean
}

export function KpiCard({ title, value, change, changeLabel, icon: Icon, iconColor = 'text-brand-lavanda/40', sub, href, info, carregando }: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0

  const card = (
    <Card className={cn('h-full', href && 'transition-colors group-hover:border-white/[0.15]')}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-brand-lavanda/40 mb-3 flex items-center gap-1">
              <span className="truncate">{title}</span>
              {info && <InfoDica>{info}</InfoDica>}
            </p>
            {carregando ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-24" />
                {sub !== undefined && <Skeleton className="h-3 w-32" />}
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {value}
                </p>
                {sub && <p className="mt-1 text-xs text-brand-lavanda/40">{sub}</p>}
                {change !== undefined && (
                  <div className={cn('flex items-center gap-1 mt-2 text-xs', isPositive ? 'text-brand-lima' : 'text-brand-rosa')}>
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPositive ? '+' : ''}{change}%
                    {changeLabel && <span className="text-brand-lavanda/30 font-normal ml-1">{changeLabel}</span>}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Icon className={cn('h-5 w-5 shrink-0', iconColor)} />
            {href && <ChevronRight className="h-3.5 w-3.5 text-brand-lavanda/20 transition-colors group-hover:text-brand-lavanda/60" />}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return href ? <Link href={href} className="group block">{card}</Link> : card
}

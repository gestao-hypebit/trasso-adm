import { cn } from '@/lib/utils'
import { temperaturaConfig, type Temperatura } from '@/lib/leads/trafego'

// Selo quente/morno/frio do lead (calculado pela landing ou escolhido à mão).
export function TemperaturaBadge({ temperatura, pontos, className }: { temperatura: Temperatura | null; pontos?: number | null; className?: string }) {
  if (!temperatura) return null
  const t = temperaturaConfig[temperatura]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none', t.classe, className)}>
      <span aria-hidden="true">{t.emoji}</span>
      {t.label}
      {pontos != null && <span className="opacity-70">· {pontos} pts</span>}
    </span>
  )
}

'use client'

import { cn } from '@/lib/utils'
import { LINHA_CORES, linhasDeReceita, type Linha } from '@/lib/financeiro/linhas'

export type FiltroLinhaValor = Linha | 'todas'

// Botões "Tudo / Serviços / Catálogo Place / Clubelly" para ver de onde veio o dinheiro.
export function FiltroLinha({ valor, onChange }: { valor: FiltroLinhaValor; onChange: (v: FiltroLinhaValor) => void }) {
  const opcoes: { value: FiltroLinhaValor; label: string; cor?: string }[] = [
    { value: 'todas', label: 'Tudo' },
    ...linhasDeReceita.map((o) => ({ ...o, cor: LINHA_CORES[o.value] })),
  ]
  return (
    <div className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
      {opcoes.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
            valor === o.value ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/40 hover:text-brand-lavanda/70',
          )}
        >
          {o.cor && <span className="h-2 w-2 rounded-full" style={{ background: o.cor }} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

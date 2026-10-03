'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export type Periodo = { mes: Date; tudo: boolean }

export const periodoInicial = (): Periodo => ({ mes: startOfMonth(new Date()), tudo: false })

// Intervalo YYYY-MM-DD do período (tudo = sem limite).
export function intervaloPeriodo(p: Periodo): [string, string] {
  return p.tudo ? ['0000-01-01', '9999-12-31'] : [format(p.mes, 'yyyy-MM-01'), format(endOfMonth(p.mes), 'yyyy-MM-dd')]
}

export function rotuloPeriodo(p: Periodo) {
  if (p.tudo) return 'Desde o início'
  const l = format(p.mes, 'MMMM yyyy', { locale: ptBR })
  return l.charAt(0).toUpperCase() + l.slice(1)
}

// Mês a mês com setas, grade de meses e "Desde o início".
// `permitirFuturo` libera meses à frente (contas a pagar/receber têm vencimentos futuros).
export function SeletorMes({ valor, onChange, permitirFuturo = false }: { valor: Periodo; onChange: (p: Periodo) => void; permitirFuturo?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [ano, setAno] = useState(() => valor.mes.getFullYear())
  const hoje = new Date()
  const ehMesAtual = format(valor.mes, 'yyyy-MM') === format(hoje, 'yyyy-MM')
  const bloqueiaProximo = !permitirFuturo && ehMesAtual

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!valor.tudo ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
          <button
            onClick={() => onChange({ ...valor, mes: subMonths(valor.mes, 1) })}
            className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => { setAno(valor.mes.getFullYear()); setAberto((v) => !v) }}
              className="flex items-center gap-1 text-sm font-medium text-brand-lavanda min-w-[130px] justify-center hover:text-brand-lavanda/80 transition-colors"
            >
              {rotuloPeriodo(valor)}
              <ChevronDown className="h-3 w-3 text-brand-lavanda/40 shrink-0" />
            </button>
            {aberto && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 rounded-xl border border-white/[0.1] bg-[#1A0533] shadow-2xl p-3 w-56">
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setAno((y) => y - 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-sm font-semibold text-brand-lavanda">{ano}</span>
                    <button
                      onClick={() => setAno((y) => y + 1)}
                      disabled={!permitirFuturo && ano >= hoje.getFullYear()}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: 12 }, (_, i) => {
                      const d = new Date(ano, i, 1)
                      const selecionado = format(d, 'yyyy-MM') === format(valor.mes, 'yyyy-MM')
                      const futuro = !permitirFuturo && d > hoje
                      const lbl = format(d, 'MMM', { locale: ptBR })
                      return (
                        <button
                          key={i}
                          disabled={futuro}
                          onClick={() => { onChange({ mes: startOfMonth(d), tudo: false }); setAberto(false) }}
                          className={cn('py-1.5 rounded-lg text-xs transition-colors', selecionado ? 'bg-brand-lima text-brand-noite font-semibold' : 'text-brand-lavanda/60 hover:bg-white/[0.06] hover:text-brand-lavanda', futuro && 'opacity-25 cursor-not-allowed')}
                        >
                          {lbl.charAt(0).toUpperCase() + lbl.slice(1, 3)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => onChange({ ...valor, mes: addMonths(valor.mes, 1) })}
            disabled={bloqueiaProximo}
            className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-brand-lima/30 bg-brand-lima/[0.04] px-4 py-2">
          <span className="text-sm font-medium text-brand-lima">Desde o início</span>
        </div>
      )}
      <button
        onClick={() => onChange({ ...valor, tudo: !valor.tudo })}
        className={cn('text-xs px-3 py-1.5 rounded-lg border transition-colors', valor.tudo ? 'border-brand-lima/30 text-brand-lima bg-brand-lima/[0.08] hover:bg-brand-lima/[0.12]' : 'border-white/[0.08] text-brand-lavanda/40 hover:text-brand-lavanda/70 hover:border-white/[0.14]')}
      >
        {valor.tudo ? 'Ver por mês' : 'Desde o início'}
      </button>
      {!valor.tudo && !ehMesAtual && (
        <button onClick={() => onChange({ mes: startOfMonth(new Date()), tudo: false })} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 transition-colors">
          Mês atual
        </button>
      )}
    </div>
  )
}

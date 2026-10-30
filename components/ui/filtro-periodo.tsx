'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn, formatDate } from '@/lib/utils'
import { diaSP, somarDias } from '@/lib/anuncios/regras'
import { intervaloAnterior, intervaloDoPeriodo, periodoOpcoes, type Intervalo, type PeriodoChave } from '@/lib/periodo'

// Uma escolha só para o sistema todo: trocar o período numa tela vale nas outras.
const CHAVE = 'periodo'
const VALIDOS = periodoOpcoes.map((o) => o.value)

export function usePeriodo(padrao: PeriodoChave = 'tudo') {
  const hoje = diaSP(new Date())
  const [periodo, setPeriodoState] = useState<PeriodoChave>(padrao)
  const [custom, setCustomState] = useState<Intervalo>({ de: somarDias(hoje, -29), ate: hoje })

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as { periodo?: PeriodoChave; custom?: Intervalo } | null
      if (salvo?.periodo && VALIDOS.includes(salvo.periodo)) setPeriodoState(salvo.periodo)
      if (salvo?.custom?.de || salvo?.custom?.ate) setCustomState(salvo.custom)
    } catch {}
  }, [])

  function salvar(p: PeriodoChave, c: Intervalo) {
    try { localStorage.setItem(CHAVE, JSON.stringify({ periodo: p, custom: c })) } catch {}
  }
  const setPeriodo = (p: PeriodoChave) => { setPeriodoState(p); salvar(p, custom) }
  const setCustom = (c: Intervalo) => { setCustomState(c); salvar(periodo, c) }

  const intervalo = intervaloDoPeriodo(periodo, hoje, custom)
  return { periodo, setPeriodo, custom, setCustom, intervalo, anterior: intervaloAnterior(intervalo), hoje, filtra: periodo !== 'tudo' }
}

export type PeriodoEstado = ReturnType<typeof usePeriodo>

// Botões de período + datas do personalizado + o intervalo por extenso.
export function FiltroPeriodo({ estado, descricao = 'Período', className }: {
  estado: PeriodoEstado
  // O que o período filtra, para o texto de apoio (ex.: "Leads que chegaram").
  descricao?: string
  className?: string
}) {
  const { periodo, setPeriodo, custom, setCustom, intervalo, hoje, filtra } = estado
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex max-w-full overflow-x-auto rounded-lg border border-white/[0.1] p-0.5">
        {periodoOpcoes.map((o) => (
          <button
            key={o.value}
            onClick={() => setPeriodo(o.value)}
            className={cn('shrink-0 rounded-md px-2.5 py-1.5 text-xs', periodo === o.value ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50 hover:text-brand-lavanda/80')}
          >{o.label}</button>
        ))}
      </div>
      {periodo === 'personalizado' && (
        <div className="flex items-center gap-2 text-xs text-brand-lavanda/50">
          <Input type="date" className="h-8 w-[150px]" value={custom.de ?? ''} onChange={(e) => setCustom({ ...custom, de: e.target.value || null })} />
          até
          <Input type="date" className="h-8 w-[150px]" value={custom.ate ?? ''} onChange={(e) => setCustom({ ...custom, ate: e.target.value || null })} />
        </div>
      )}
      {filtra && intervalo.de && (
        <span className="text-[11px] text-brand-lavanda/40">
          {descricao} {intervalo.de === intervalo.ate ? `em ${formatDate(intervalo.de, 'dd/MM')}` : `de ${formatDate(intervalo.de, 'dd/MM')} a ${formatDate(intervalo.ate ?? hoje, 'dd/MM')}`}
        </span>
      )}
    </div>
  )
}

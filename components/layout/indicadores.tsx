'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Landmark, TrendingUp } from 'lucide-react'
import { buscarTudo } from '@/lib/anuncios/consulta'
import { hojeISO, resumoVendas, saldoDaConta, type LancamentoSaldo, type ResumoVendas } from '@/lib/financeiro'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'

type Indicadores = { vendas: ResumoVendas | null; saldo: number | null }

const IndicadoresContext = createContext<Indicadores>({ vendas: null, saldo: null })

const ATUALIZAR_A_CADA_MS = 60_000

// Fica no layout porque cada página monta o próprio Header: assim os valores
// não somem a cada troca de tela. Se uma busca falhar, mantém o último valor.
export function IndicadoresProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [indicadores, setIndicadores] = useState<Indicadores>({ vendas: null, saldo: null })
  const ultimaBusca = useRef(0)

  const carregar = useCallback(async () => {
    const busca = ++ultimaBusca.current
    const db = createClient() as any
    const [vendas, saldo] = await Promise.allSettled([
      db.from('metas_movimentacoes').select('valor').eq('tipo', 'novo').eq('data', hojeISO()).then(({ data, error }: any) => {
        if (error) throw new Error(error.message)
        return resumoVendas(data ?? [])
      }),
      buscarTudo<LancamentoSaldo>((de, ate) =>
        db.from('lancamentos').select('tipo, valor, status').in('status', ['recebido', 'pago']).order('id').range(de, ate),
      ).then(saldoDaConta),
    ])
    if (busca !== ultimaBusca.current) return
    setIndicadores((atual) => ({
      vendas: vendas.status === 'fulfilled' ? vendas.value : atual.vendas,
      saldo: saldo.status === 'fulfilled' ? saldo.value : atual.saldo,
    }))
  }, [])

  useEffect(() => { carregar() }, [carregar, pathname])

  useEffect(() => {
    const intervalo = setInterval(() => { if (!document.hidden) carregar() }, ATUALIZAR_A_CADA_MS)
    window.addEventListener('focus', carregar)
    return () => {
      clearInterval(intervalo)
      window.removeEventListener('focus', carregar)
    }
  }, [carregar])

  return <IndicadoresContext.Provider value={indicadores}>{children}</IndicadoresContext.Provider>
}

const chip = 'flex h-10 min-w-0 items-center gap-2 rounded-lg px-2.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lavanda'
const rotulo = 'block text-[10px] font-semibold uppercase leading-tight tracking-wide opacity-80'
const valor = 'block truncate text-sm font-bold leading-tight tabular-nums'

export function IndicadoresTopo({ className }: { className?: string }) {
  const { vendas, saldo } = useContext(IndicadoresContext)
  const vendeuHoje = (vendas?.quantidade ?? 0) > 0
  const quantidade = vendas?.quantidade ?? 0

  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <Link
        href="/metas"
        title="Clientes novos registrados hoje nas Metas"
        className={cn(chip, vendeuHoje ? 'bg-brand-lima text-brand-noite' : 'border border-brand-lima/40 bg-brand-lima/10 text-brand-lima')}
      >
        <TrendingUp className="h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className={rotulo}>Vendas hoje{vendeuHoje && ` · ${quantidade}`}</span>
          <span className={valor}>{vendas ? formatCurrency(vendas.total) : '...'}</span>
        </span>
      </Link>
      <Link
        href="/financeiro/fluxo-de-caixa"
        title="Tudo que foi recebido menos tudo que foi pago"
        className={cn(chip, (saldo ?? 0) < 0 ? 'bg-brand-rosa text-brand-noite' : 'bg-brand-violeta text-white')}
      >
        <Landmark className="h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className={rotulo}>Saldo em conta</span>
          <span className={valor}>{saldo === null ? '...' : formatCurrency(saldo)}</span>
        </span>
      </Link>
    </div>
  )
}

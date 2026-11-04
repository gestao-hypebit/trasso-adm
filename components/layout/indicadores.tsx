'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Landmark, TrendingUp } from 'lucide-react'
import { buscarTudo } from '@/lib/anuncios/consulta'
import { hojeISO, resumoRecebido, saldoDaConta, type LancamentoSaldo, type ResumoRecebido } from '@/lib/financeiro'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'

type Indicadores = { recebido: ResumoRecebido | null; faltaMigration: boolean; saldo: number | null }

const IndicadoresContext = createContext<Indicadores>({ recebido: null, faltaMigration: false, saldo: null })

const ATUALIZAR_A_CADA_MS = 60_000
const AVISO_MIGRATION = 'Rode a migration 20261116000000_lancamentos_recebido_em.sql no Supabase para ver este valor.'

// Fica no layout porque cada página monta o próprio Header: assim os valores
// não somem a cada troca de tela. Se uma busca falhar, mantém o último valor.
export function IndicadoresProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [indicadores, setIndicadores] = useState<Indicadores>({ recebido: null, faltaMigration: false, saldo: null })
  const ultimaBusca = useRef(0)

  const carregar = useCallback(async () => {
    const busca = ++ultimaBusca.current
    const db = createClient() as any
    const [hoje, saldo] = await Promise.all([
      db.from('lancamentos').select('valor').eq('tipo', 'receita').eq('status', 'recebido').eq('recebido_em', hojeISO()),
      buscarTudo<LancamentoSaldo>((de, ate) =>
        db.from('lancamentos').select('tipo, valor, status').in('status', ['recebido', 'pago']).order('id').range(de, ate),
      ).then(saldoDaConta, () => null),
    ])
    if (busca !== ultimaBusca.current) return
    setIndicadores((atual) => ({
      recebido: hoje.error ? atual.recebido : resumoRecebido(hoje.data ?? []),
      faltaMigration: hoje.error?.code === '42703',
      saldo: saldo ?? atual.saldo,
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
  const { recebido, faltaMigration, saldo } = useContext(IndicadoresContext)
  const quantidade = recebido?.quantidade ?? 0
  const recebeuHoje = quantidade > 0

  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <Link
        href="/financeiro/receitas"
        title={faltaMigration ? AVISO_MIGRATION : 'Tudo que entrou hoje. Nas cobranças do Asaas, já sem a taxa.'}
        className={cn(chip, recebeuHoje ? 'bg-brand-lima text-brand-noite' : 'border border-brand-lima/40 bg-brand-lima/10 text-brand-lima')}
      >
        <TrendingUp className="h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className={rotulo}>Recebido hoje{recebeuHoje && ` · ${quantidade}`}</span>
          <span className={valor}>{recebido ? formatCurrency(recebido.total) : faltaMigration ? '—' : '...'}</span>
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

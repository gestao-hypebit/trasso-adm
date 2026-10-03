'use client'

import { createContext, useContext, useEffect, useState } from 'react'

// Frente de negócio escolhida no topo do menu. Filtra menu, clientes,
// dashboard e financeiro. Fica salva no navegador.
export type Frente = 'agencia' | 'catalogo_place' | 'todas'
export type FrenteLancamento = 'agencia' | 'catalogo_place' | 'geral'

export const frenteOpcoes: { value: Frente; label: string }[] = [
  { value: 'agencia', label: 'Agência' },
  { value: 'catalogo_place', label: 'Catálogo Place' },
  { value: 'todas', label: 'Tudo' },
]

export const frenteLancamentoOpcoes: { value: FrenteLancamento; label: string }[] = [
  { value: 'agencia', label: 'Agência' },
  { value: 'catalogo_place', label: 'Catálogo Place' },
  { value: 'geral', label: 'Geral (compartilhado)' },
]

export const labelFrenteLancamento = (v: string | null | undefined) =>
  frenteLancamentoOpcoes.find((o) => o.value === v)?.label.replace(' (compartilhado)', '') ?? '—'

// Lançamentos de cada frente. Custos gerais (compartilhados) não entram no
// resultado de nenhuma frente — só no "Tudo". Em contas a pagar/receber eles
// aparecem também (incluirGeral), para nenhuma conta sumir da tela.
export function frentesDosLancamentos(frente: Frente, incluirGeral = false): FrenteLancamento[] | null {
  if (frente === 'todas') return null
  return incluirGeral ? [frente, 'geral'] : [frente]
}

// Aplica o filtro de frente numa consulta de lançamentos do Supabase.
export function filtrarLancamentos<Q extends { in: (col: string, vals: string[]) => Q }>(
  query: Q,
  frente: Frente,
  opcoes: { incluirGeral?: boolean } = {},
): Q {
  const frentes = frentesDosLancamentos(frente, opcoes.incluirGeral)
  return frentes ? query.in('frente', frentes) : query
}

// Tipos de cliente de cada frente. "ambos" aparece nas duas.
export function tiposDeCliente(frente: Frente): string[] | null {
  if (frente === 'agencia') return ['agencia', 'ambos']
  if (frente === 'catalogo_place') return ['saas', 'ambos']
  return null
}

// `pronto` fica falso até ler a frente salva: as telas esperam para não
// carregar duas vezes (uma com "Tudo" e outra com a frente certa).
const FrenteContext = createContext<{ frente: Frente; setFrente: (f: Frente) => void; pronto: boolean } | null>(null)

const CHAVE = 'frente'

export function FrenteProvider({ children }: { children: React.ReactNode }) {
  const [frente, setFrenteState] = useState<Frente>('todas')
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    try {
      const salva = localStorage.getItem(CHAVE)
      if (salva === 'agencia' || salva === 'catalogo_place' || salva === 'todas') setFrenteState(salva)
    } catch {}
    setPronto(true)
  }, [])

  function setFrente(f: Frente) {
    setFrenteState(f)
    try { localStorage.setItem(CHAVE, f) } catch {}
  }

  return <FrenteContext.Provider value={{ frente, setFrente, pronto }}>{children}</FrenteContext.Provider>
}

export function useFrente() {
  const ctx = useContext(FrenteContext)
  if (!ctx) throw new Error('useFrente deve ser usado dentro de FrenteProvider')
  return ctx
}

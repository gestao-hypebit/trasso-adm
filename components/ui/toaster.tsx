'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Aviso = {
  id: number
  texto: string
  tipo: 'sucesso' | 'erro'
  desfazer?: () => void | Promise<void>
}

type Opcoes = { tipo?: Aviso['tipo']; desfazer?: Aviso['desfazer'] }

const AvisoContext = createContext<((texto: string, opcoes?: Opcoes) => void) | null>(null)

// Aviso no canto da tela: confirma que salvou e, quando dá, oferece "Desfazer".
export function useAviso() {
  const ctx = useContext(AvisoContext)
  // Fora do provider (ex.: página pública) não quebra, só não mostra.
  return ctx ?? (() => {})
}

const DURACAO = 5000

export function AvisoProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const seq = useRef(0)

  const fechar = useCallback((id: number) => setAvisos((prev) => prev.filter((a) => a.id !== id)), [])

  const avisar = useCallback((texto: string, opcoes: Opcoes = {}) => {
    const id = ++seq.current
    setAvisos((prev) => [...prev.slice(-2), { id, texto, tipo: opcoes.tipo ?? 'sucesso', desfazer: opcoes.desfazer }])
    setTimeout(() => fechar(id), opcoes.desfazer ? DURACAO + 2000 : DURACAO)
  }, [fechar])

  return (
    <AvisoContext.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:items-end" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border bg-[#141318] px-4 py-3 text-sm shadow-2xl animate-in fade-in slide-in-from-bottom-2',
              a.tipo === 'erro' ? 'border-brand-rosa/40' : 'border-white/[0.1]'
            )}
          >
            {a.tipo === 'erro'
              ? <AlertTriangle className="h-4 w-4 shrink-0 text-brand-rosa" />
              : <Check className="h-4 w-4 shrink-0 text-brand-lima" />}
            <span className="flex-1 text-brand-lavanda/90">{a.texto}</span>
            {a.desfazer && (
              <button
                type="button"
                onClick={async () => { fechar(a.id); await a.desfazer?.() }}
                className="shrink-0 text-xs font-semibold text-brand-violeta hover:text-brand-lavanda"
              >
                Desfazer
              </button>
            )}
            <button type="button" onClick={() => fechar(a.id)} aria-label="Fechar" className="shrink-0 text-brand-lavanda/30 hover:text-brand-lavanda/70">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </AvisoContext.Provider>
  )
}

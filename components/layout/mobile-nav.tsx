'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// Controla a sidebar como gaveta no celular (abaixo de md). No desktop ela é fixa e isto não tem efeito.
const MobileNavContext = createContext<{ aberto: boolean; abrir: () => void; fechar: () => void } | null>(null)

export function useMobileNav() {
  const ctx = useContext(MobileNavContext)
  if (!ctx) throw new Error('useMobileNav deve ser usado dentro de MobileNavProvider')
  return ctx
}

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const pathname = usePathname()

  // Fecha ao navegar
  useEffect(() => { setAberto(false) }, [pathname])

  // Trava o scroll do fundo enquanto a gaveta está aberta
  useEffect(() => {
    document.body.style.overflow = aberto ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [aberto])

  return (
    <MobileNavContext.Provider value={{ aberto, abrir: () => setAberto(true), fechar: () => setAberto(false) }}>
      {children}
    </MobileNavContext.Provider>
  )
}

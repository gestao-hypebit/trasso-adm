'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, FolderOpen, FileText, FileSignature, Loader2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Tipo = 'cliente' | 'projeto' | 'proposta' | 'contrato'
type ResultItem = { id: string; tipo: Tipo; titulo: string; subtitulo?: string; href: string }

const TIPOS: Tipo[] = ['cliente', 'projeto', 'proposta', 'contrato']
const ICONS: Record<Tipo, React.FC<any>> = { cliente: Users, projeto: FolderOpen, proposta: FileText, contrato: FileSignature }
const LABELS: Record<Tipo, string> = { cliente: 'Clientes', projeto: 'Projetos', proposta: 'Propostas', contrato: 'Contratos' }

const CommandPaletteContext = createContext<{ open: () => void } | null>(null)

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPalette deve ser usado dentro de CommandPaletteProvider')
  return ctx
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setActiveIndex(0)
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    const termo = query.trim()
    if (!termo) { setResults([]); setLoading(false); return }
    setLoading(true)
    const handle = setTimeout(async () => {
      const supabase = createClient() as any
      const safe = termo.replace(/[,()%]/g, '')
      const like = `%${safe}%`
      const [{ data: clientes }, { data: projetos }, { data: propostas }, { data: contratos }] = await Promise.all([
        supabase.from('clientes').select('id, nome, empresa').or(`nome.ilike.${like},empresa.ilike.${like}`).limit(5),
        supabase.from('projetos').select('id, nome, clientes(nome)').ilike('nome', like).limit(5),
        supabase.from('propostas').select('id, numero, titulo, clientes(nome)').or(`numero.ilike.${like},titulo.ilike.${like}`).limit(5),
        supabase.from('contratos').select('id, numero, titulo, clientes(nome)').or(`numero.ilike.${like},titulo.ilike.${like}`).limit(5),
      ])
      const items: ResultItem[] = [
        ...(clientes ?? []).map((c: any) => ({ id: c.id, tipo: 'cliente' as const, titulo: c.nome, subtitulo: c.empresa ?? undefined, href: `/clientes/${c.id}` })),
        ...(projetos ?? []).map((p: any) => ({ id: p.id, tipo: 'projeto' as const, titulo: p.nome, subtitulo: p.clientes?.nome, href: `/projetos/${p.id}` })),
        ...(propostas ?? []).map((p: any) => ({ id: p.id, tipo: 'proposta' as const, titulo: p.titulo, subtitulo: `${p.numero}${p.clientes?.nome ? ' · ' + p.clientes.nome : ''}`, href: `/propostas/${p.id}` })),
        ...(contratos ?? []).map((c: any) => ({ id: c.id, tipo: 'contrato' as const, titulo: c.titulo, subtitulo: `${c.numero}${c.clientes?.nome ? ' · ' + c.clientes.nome : ''}`, href: `/contratos/${c.id}` })),
      ]
      setResults(items)
      setActiveIndex(0)
      setLoading(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  const select = useCallback((item: ResultItem) => {
    setOpen(false)
    router.push(item.href)
  }, [router])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[activeIndex]) select(results[activeIndex]) }
  }

  const grupos = TIPOS.map((tipo) => ({ tipo, items: results.filter((r) => r.tipo === tipo) })).filter((g) => g.items.length > 0)
  let flatIndex = -1

  return (
    <CommandPaletteContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-lg top-[20%] translate-y-0 gap-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 border-b border-white/[0.08]">
            <Search className="h-4 w-4 text-brand-lavanda/40 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar clientes, projetos, propostas, contratos..."
              className="flex-1 bg-transparent py-3.5 text-sm text-brand-lavanda placeholder:text-brand-lavanda/30 outline-none"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-brand-lavanda/40 shrink-0" />}
          </div>
          <div className="max-h-80 overflow-y-auto py-2">
            {!query.trim() ? (
              <p className="text-center text-xs text-brand-lavanda/30 py-8">Digite para buscar em todo o sistema</p>
            ) : results.length === 0 && !loading ? (
              <p className="text-center text-xs text-brand-lavanda/30 py-8">Nenhum resultado para &ldquo;{query}&rdquo;</p>
            ) : (
              grupos.map((grupo) => {
                const Icon = ICONS[grupo.tipo]
                return (
                  <div key={grupo.tipo} className="mb-1 last:mb-0">
                    <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-brand-lavanda/30">{LABELS[grupo.tipo]}</p>
                    {grupo.items.map((item) => {
                      flatIndex++
                      const isActive = flatIndex === activeIndex
                      return (
                        <button
                          key={item.id}
                          onClick={() => select(item)}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          className={cn('w-full flex items-center gap-3 px-4 py-2 text-left transition-colors', isActive ? 'bg-brand-violeta/15' : 'hover:bg-white/[0.04]')}
                        >
                          <Icon className="h-4 w-4 text-brand-violeta shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-brand-lavanda truncate">{item.titulo}</span>
                            {item.subtitulo && <span className="block text-xs text-brand-lavanda/40 truncate">{item.subtitulo}</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
          <div className="border-t border-white/[0.06] px-4 py-2 flex items-center gap-3 text-[10px] text-brand-lavanda/30">
            <span>↑↓ navegar</span>
            <span>↵ abrir</span>
            <span>esc fechar</span>
          </div>
        </DialogContent>
      </Dialog>
    </CommandPaletteContext.Provider>
  )
}

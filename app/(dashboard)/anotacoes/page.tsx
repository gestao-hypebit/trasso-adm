'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, X, GripVertical, AlertCircle } from 'lucide-react'
import {
  DndContext, DragEndEvent, useDraggable,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Anotacao = {
  id: string
  conteudo: string
  cor: string
  pos_x: number
  pos_y: number
  largura: number
  altura: number
  created_at: string
}

const CORES: Record<string, { bg: string; text: string; header: string; dot: string }> = {
  amarelo: { bg: 'bg-yellow-300', text: 'text-yellow-950', header: 'bg-yellow-400/20', dot: 'bg-yellow-300' },
  verde:   { bg: 'bg-lime-300',   text: 'text-lime-950',   header: 'bg-lime-400/20',   dot: 'bg-lime-300'   },
  rosa:    { bg: 'bg-pink-300',   text: 'text-pink-950',   header: 'bg-pink-400/20',   dot: 'bg-pink-300'   },
  violeta: { bg: 'bg-violet-300', text: 'text-violet-950', header: 'bg-violet-400/20', dot: 'bg-violet-300' },
  azul:    { bg: 'bg-sky-300',    text: 'text-sky-950',    header: 'bg-sky-400/20',    dot: 'bg-sky-300'    },
}

const MIN_W = 160
const MIN_H = 140
const DEFAULT_W = 224
const DEFAULT_H = 180
const CANVAS_W = 2400
const CANVAS_H = 1600

// ── Post-it card ──────────────────────────────────────────────────────────────

function PostIt({ nota, onUpdate, onDelete }: {
  nota: Anotacao
  onUpdate: (id: string, patch: Partial<Anotacao>) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: nota.id })
  const c = CORES[nota.cor] ?? CORES.amarelo
  const [texto, setTexto] = useState(nota.conteudo)

  // tamanho local para resize fluido
  const [liveSize, setLiveSize] = useState({ w: nota.largura ?? DEFAULT_W, h: nota.altura ?? DEFAULT_H })
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  // sincroniza quando o parent atualiza (ex: reload)
  useEffect(() => {
    if (!resizeRef.current) {
      setLiveSize({ w: nota.largura ?? DEFAULT_W, h: nota.altura ?? DEFAULT_H })
    }
  }, [nota.largura, nota.altura])

  const style: React.CSSProperties = {
    position: 'absolute',
    left: nota.pos_x,
    top: nota.pos_y,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : 1,
    width: liveSize.w,
    height: liveSize.h,
    willChange: isDragging ? 'transform' : undefined,
  }

  function salvarTexto() {
    if (texto !== nota.conteudo) onUpdate(nota.id, { conteudo: texto })
  }

  function handleResizeDown(e: React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    resizeRef.current = { x: e.clientX, y: e.clientY, w: liveSize.w, h: liveSize.h }

    function onMove(ev: PointerEvent) {
      if (!resizeRef.current) return
      setLiveSize({
        w: Math.max(MIN_W, resizeRef.current.w + ev.clientX - resizeRef.current.x),
        h: Math.max(MIN_H, resizeRef.current.h + ev.clientY - resizeRef.current.y),
      })
    }

    function onUp(ev: PointerEvent) {
      if (!resizeRef.current) return
      const finalW = Math.max(MIN_W, resizeRef.current.w + ev.clientX - resizeRef.current.x)
      const finalH = Math.max(MIN_H, resizeRef.current.h + ev.clientY - resizeRef.current.y)
      setLiveSize({ w: finalW, h: finalH })
      onUpdate(nota.id, { largura: finalW, altura: finalH })
      resizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div ref={setNodeRef} style={style} className={cn('rounded shadow-xl shadow-black/40 flex flex-col select-none group', c.bg)}>
      {/* header com handle de arrastar + paleta + excluir */}
      <div className={cn('flex items-center gap-1 px-1.5 py-1.5 rounded-t shrink-0', c.header)}>
        <button
          {...listeners}
          {...attributes}
          className={cn('cursor-grab active:cursor-grabbing shrink-0 opacity-40 hover:opacity-70 transition-opacity', c.text)}
          title="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex gap-1 flex-1 items-center">
          {Object.entries(CORES).map(([key, cv]) => (
            <button
              key={key}
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onUpdate(nota.id, { cor: key })}
              title={key}
              className={cn(
                'w-3.5 h-3.5 rounded-full border-2 transition-transform hover:scale-125',
                cv.dot,
                nota.cor === key ? 'border-white/70 scale-110' : 'border-black/10'
              )}
            />
          ))}
        </div>

        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onDelete(nota.id)}
          className={cn('opacity-40 hover:opacity-80 transition-opacity', c.text)}
          title="Excluir"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* área de texto (ocupa o espaço restante) */}
      <textarea
        className={cn(
          'flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none',
          'placeholder:opacity-30 select-text cursor-text min-h-0',
          c.text
        )}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onBlur={salvarTexto}
        onPointerDown={e => e.stopPropagation()}
        placeholder="Escreva aqui..."
      />

      {/* rodapé: data + handle de redimensionar */}
      <div className="flex items-end justify-between shrink-0 pb-1 pl-3">
        <p className={cn('text-[10px] opacity-30 font-medium', c.text)}>
          {new Date(nota.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </p>

        {/* handle de resize — 3 pontos diagonais no canto inferior direito */}
        <div
          onPointerDown={handleResizeDown}
          className={cn(
            'p-1.5 cursor-se-resize opacity-0 group-hover:opacity-30 hover:!opacity-60 transition-opacity',
            c.text
          )}
          title="Redimensionar"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <circle cx="8.5" cy="8.5" r="1.5" />
            <circle cx="4.5" cy="8.5" r="1.5" />
            <circle cx="8.5" cy="4.5" r="1.5" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnotacoesPage() {
  const [notas, setNotas] = useState<Anotacao[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  useEffect(() => {
    const supabase = createClient() as any
    async function load() {
      const { data, error } = await supabase.from('anotacoes').select('*').order('created_at')
      if (error) {
        setErro('Tabela "anotacoes" não encontrada. Execute o DDL no Supabase.')
      } else {
        setNotas((data as Anotacao[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function criarNota() {
    setErro(null)
    const supabase = createClient() as any
    const nova = {
      conteudo: '',
      cor: 'amarelo',
      pos_x: 80 + Math.floor(Math.random() * 320),
      pos_y: 80 + Math.floor(Math.random() * 240),
      largura: DEFAULT_W,
      altura: DEFAULT_H,
    }
    const { data, error } = await supabase.from('anotacoes').insert(nova).select('*').single()
    if (error) {
      setErro('Erro ao criar anotação: ' + error.message)
      return
    }
    if (data) setNotas(prev => [...prev, data as Anotacao])
  }

  async function atualizarNota(id: string, patch: Partial<Anotacao>) {
    setNotas(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
    const supabase = createClient() as any
    await supabase.from('anotacoes').update(patch).eq('id', id)
  }

  async function excluirNota(id: string) {
    setNotas(prev => prev.filter(n => n.id !== id))
    const supabase = createClient() as any
    await supabase.from('anotacoes').delete().eq('id', id)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event
    const nota = notas.find(n => n.id === active.id)
    if (!nota || (delta.x === 0 && delta.y === 0)) return
    atualizarNota(nota.id, {
      pos_x: Math.max(0, nota.pos_x + delta.x),
      pos_y: Math.max(0, nota.pos_y + delta.y),
    })
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100vh' }}>
      <Header title="Anotações" description="Canvas de post-its" />

      <div className="shrink-0 px-6 py-3 border-b border-white/[0.06] flex items-center justify-between bg-brand-noite/95 backdrop-blur-sm">
        <p className="text-brand-lavanda/40 text-sm">
          {loading ? '' : notas.length > 0
            ? `${notas.length} ${notas.length === 1 ? 'anotação' : 'anotações'}`
            : 'Canvas vazio'}
        </p>
        <Button onClick={criarNota} size="sm">
          <Plus className="h-4 w-4" />
          Nova Anotação
        </Button>
      </div>

      {erro && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-2.5 bg-brand-rosa/10 border-b border-brand-rosa/20 text-brand-rosa text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="ml-auto opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-brand-lavanda/40 text-sm">
          Carregando...
        </div>
      ) : (
        <div className="flex-1 overflow-auto min-h-0">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div
              className="relative"
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              {notas.length === 0 && !erro && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <p className="text-brand-lavanda/20 text-base font-medium">Canvas vazio</p>
                  <p className="text-brand-lavanda/15 text-sm">Clique em &ldquo;Nova Anotação&rdquo; para começar</p>
                </div>
              )}
              {notas.map(nota => (
                <PostIt
                  key={nota.id}
                  nota={nota}
                  onUpdate={atualizarNota}
                  onDelete={excluirNota}
                />
              ))}
            </div>
          </DndContext>
        </div>
      )}
    </div>
  )
}

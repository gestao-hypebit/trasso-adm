'use client'

import { Plus } from 'lucide-react'
import { FORMATOS, diasDoMes, inicioDaSemana, ordenarPosts, type Post } from '@/lib/social/tipos'
import { cn, toISODateLocal } from '@/lib/utils'

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const corAprovacao = { pendente: '', aprovado: 'ring-1 ring-brand-lima/50', ajustes: 'ring-1 ring-brand-rosa/60' } as const

// Grade do mês com os posts em cada dia. No admin, clicar no dia vazio cria um post.
export function CalendarioMes({ mes, posts, onPost, onNovo, mostrarAprovacao = true }: {
  mes: string
  posts: Post[]
  onPost: (p: Post) => void
  onNovo?: (data: string) => void
  mostrarAprovacao?: boolean
}) {
  const dias = diasDoMes(mes)
  const vazios = inicioDaSemana(mes)
  const hoje = toISODateLocal(new Date())
  const porDia = new Map<string, Post[]>()
  for (const p of ordenarPosts(posts)) porDia.set(p.data, [...(porDia.get(p.data) ?? []), p])

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-7 overflow-hidden rounded-xl border border-white/[0.06]">
        {SEMANA.map((d) => (
          <div key={d} className="border-b border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-brand-lavanda/40">{d}</div>
        ))}
        {Array.from({ length: vazios }, (_, i) => <div key={`v${i}`} className="border-b border-r border-white/[0.04] bg-black/10" />)}
        {dias.map((dia, i) => {
          const itens = porDia.get(dia) ?? []
          const fimDeSemana = (vazios + i) % 7 === 0 || (vazios + i) % 7 === 6
          return (
            <div
              key={dia}
              className={cn('group relative min-h-[112px] border-b border-r border-white/[0.04] p-1.5', fimDeSemana && 'bg-white/[0.015]')}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px]', dia === hoje ? 'bg-brand-lima font-bold text-brand-noite' : 'text-brand-lavanda/50')}>
                  {Number(dia.slice(8))}
                </span>
                {onNovo && (
                  <button
                    type="button"
                    onClick={() => onNovo(dia)}
                    aria-label="Novo post neste dia"
                    className="rounded p-0.5 text-brand-lavanda/30 opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-brand-lima group-hover:opacity-100 max-md:opacity-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {itens.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPost(p)}
                    className={cn(
                      'flex w-full items-start gap-1.5 rounded-md bg-white/[0.05] px-1.5 py-1 text-left transition-colors hover:bg-white/[0.1]',
                      mostrarAprovacao && corAprovacao[p.aprovacao],
                    )}
                  >
                    <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: FORMATOS[p.formato]?.cor }} />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium leading-tight text-brand-lavanda">{p.titulo}</span>
                      <span className="block truncate text-[10px] leading-tight text-brand-lavanda/40">{FORMATOS[p.formato]?.label}{p.horario && ` · ${p.horario}`}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LegendaFormatos() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {Object.entries(FORMATOS).map(([k, f]) => (
        <span key={k} className="flex items-center gap-1.5 text-[11px] text-brand-lavanda/50">
          <span className="h-2 w-2 rounded-full" style={{ background: f.cor }} /> {f.label}
        </span>
      ))}
    </div>
  )
}

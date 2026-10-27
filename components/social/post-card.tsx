'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { APROVACAO, FORMATOS, PRODUCAO, REDES, type Post } from '@/lib/social/tipos'
import { TIPOS_CONTEUDO, type TipoConteudo } from '@/lib/social/artes'
import { cn, formatDate } from '@/lib/utils'

export const ehVideo = (url: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)

// Mídias do post. O container segue o tamanho da arte (sem faixa vazia);
// com mais de uma, vira carrossel de deslizar (scroll-snap) com setas e aviso.
export function Midias({ urls, carrossel = false, className }: { urls: string[]; carrossel?: boolean; className?: string }) {
  const trilho = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  if (!urls.length) {
    return (
      <div className={cn('flex aspect-[4/5] items-center justify-center bg-white/[0.03] text-brand-lavanda/20', className)}>
        <ImageIcon className="h-8 w-8" />
      </div>
    )
  }
  const varias = urls.length > 1
  const ir = (k: number) => {
    const el = trilho.current
    if (el) el.scrollTo({ left: ((k + urls.length) % urls.length) * el.clientWidth, behavior: 'smooth' })
  }
  return (
    <div className={cn('flex flex-col', className)}>
      {varias && (
        <div className="flex items-center gap-2 bg-brand-violeta px-3 py-2 text-xs font-semibold text-white">
          <Layers className="h-4 w-4 shrink-0" />
          <span>{carrossel ? 'Carrossel' : 'Várias mídias'} · {urls.length} {urls.some(ehVideo) ? 'mídias' : 'imagens'}</span>
          <span className="ml-auto flex items-center gap-1 font-normal text-white/85">Deslize para ver <ChevronRight className="h-3.5 w-3.5" /></span>
        </div>
      )}
      <div className="relative bg-black">
        <div
          ref={trilho}
          onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="flex snap-x snap-mandatory items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {urls.map((u) => (
            <div key={u} className="w-full shrink-0 snap-center">
              {ehVideo(u)
                ? <video src={u} controls playsInline className="block h-auto w-full" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={u} alt="" className="block h-auto w-full" />}
            </div>
          ))}
        </div>
        {varias && (
          <>
            <button type="button" onClick={() => ir(i - 1)} aria-label="Anterior" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => ir(i + 1)} aria-label="Próxima" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><ChevronRight className="h-4 w-4" /></button>
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{i + 1}/{urls.length}</span>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {urls.map((u, k) => <span key={u} className={cn('h-1.5 w-1.5 rounded-full', k === i ? 'bg-white' : 'bg-white/40')} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function Redes({ redes }: { redes: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {redes.map((r) => {
        const info = REDES[r as keyof typeof REDES]
        return (
          <span key={r} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: info?.cor ?? '#555' }}>
            {info?.label ?? r}
          </span>
        )
      })}
    </span>
  )
}

// Post completo: mídia à esquerda, textos à direita. `acoes` fica no rodapé.
export function PostCard({ post, interno = false, acoes }: { post: Post; interno?: boolean; acoes?: React.ReactNode }) {
  const formato = FORMATOS[post.formato]
  const aprov = APROVACAO[post.aprovacao]
  const tipo = post.tipo ? TIPOS_CONTEUDO[post.tipo as TipoConteudo] : null
  return (
    <article id={`post-${post.id}`} className="scroll-mt-24 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] md:grid md:grid-cols-[280px_1fr]">
      <Midias urls={post.midias} carrossel={post.formato === 'carrossel'} className="md:self-start" />
      <div className="flex min-w-0 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold capitalize text-brand-lavanda">{formatDate(post.data, "EEEE, dd/MM")}{post.horario && ` · ${post.horario}`}</span>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-brand-noite" style={{ background: formato?.cor }}>{formato?.label}</span>
          {interno && tipo && <span className="rounded border px-1.5 py-0.5 text-[10px] font-semibold" style={{ borderColor: tipo.cor, color: tipo.cor }}>{tipo.label}</span>}
          <Redes redes={post.redes} />
          <span className="ml-auto flex gap-1.5">
            {interno && <Badge variant={PRODUCAO[post.producao]?.variant}>{PRODUCAO[post.producao]?.label}</Badge>}
            <Badge variant={aprov.variant}>{!interno && post.aprovacao === 'pendente' ? 'Aguardando sua aprovação' : aprov.label}</Badge>
          </span>
        </div>
        <h3 className="text-lg font-bold leading-snug text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{post.titulo}</h3>

        {post.legenda && (
          <Bloco titulo="Legenda">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-lavanda/85">{post.legenda}</p>
            {post.hashtags && <p className="mt-2 text-sm text-brand-violeta">{post.hashtags}</p>}
          </Bloco>
        )}
        {!post.legenda && post.hashtags && <p className="text-sm text-brand-violeta">{post.hashtags}</p>}
        {interno && post.roteiro && (
          <Bloco titulo={post.formato === 'reels' || post.formato === 'video' ? 'Roteiro' : post.formato === 'carrossel' ? 'Slides' : 'Arte'}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-lavanda/70">{post.roteiro}</p>
          </Bloco>
        )}
        {post.cta && <p className="text-xs text-brand-lavanda/50"><span className="font-semibold uppercase tracking-wide text-brand-lavanda/40">CTA</span> · {post.cta}</p>}

        {post.comentario_cliente && (
          <div className={cn('rounded-lg border px-3 py-2 text-sm', post.aprovacao === 'ajustes' ? 'border-brand-rosa/25 bg-brand-rosa/[0.06]' : 'border-brand-lima/20 bg-brand-lima/[0.05]')}>
            <p className="mb-0.5 text-[11px] text-brand-lavanda/50">
              {post.respondido_nome ?? 'Cliente'}{post.respondido_em && ` · ${formatDate(post.respondido_em, "dd/MM 'às' HH:mm")}`}
            </p>
            <p className="whitespace-pre-wrap text-brand-lavanda/85">{post.comentario_cliente}</p>
          </div>
        )}

        {acoes && <div className="mt-auto flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">{acoes}</div>}
      </div>
    </article>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-lavanda/40">{titulo}</p>
      {children}
    </div>
  )
}

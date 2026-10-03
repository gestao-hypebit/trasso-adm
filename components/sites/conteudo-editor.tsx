'use client'

import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SECOES, type Conteudo, type SecaoConteudo } from '@/lib/sites/tipos'

const nomeSecao = (tipo: string) => SECOES.find((s) => s.value === tipo)?.label ?? tipo

// Revisão dos textos antes de gerar o site. Marcadores entre colchetes
// ("[10] anos") são dados que a IA não sabia: confirme ou troque.
export function ConteudoEditor({ valor, onChange }: { valor: Conteudo; onChange: (c: Conteudo) => void }) {
  const setSecao = (i: number, s: SecaoConteudo) => onChange({ ...valor, secoes: valor.secoes.map((x, j) => (j === i ? s : x)) })
  const marcadores = JSON.stringify(valor).match(/\[[^\]"]{1,60}\]/g)?.length ?? 0

  return (
    <div className="space-y-3">
      {marcadores > 0 && (
        <p className="rounded-lg border border-yellow-400/20 bg-yellow-400/[0.05] px-3 py-2 text-xs text-brand-lavanda/70">
          Há {marcadores} marcador(es) entre <span className="text-yellow-400">[colchetes]</span>: dados que a IA não tinha (números, nomes). Confirme ou troque antes de mostrar ao cliente.
        </p>
      )}

      <details className="group rounded-xl border border-white/[0.06] bg-white/[0.02]" open>
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-brand-lavanda">
          Página (Google e aba)
          <ChevronDown className="h-4 w-4 text-brand-lavanda/40 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2 px-4 pb-4">
          <Rotulo texto="Título da página" />
          <Input value={valor.titulo_pagina} onChange={(e) => onChange({ ...valor, titulo_pagina: e.target.value })} />
          <Rotulo texto="Descrição no Google" />
          <Textarea rows={2} value={valor.meta_descricao} onChange={(e) => onChange({ ...valor, meta_descricao: e.target.value })} />
          <Rotulo texto="Slogan" />
          <Input value={valor.slogan} onChange={(e) => onChange({ ...valor, slogan: e.target.value })} />
        </div>
      </details>

      {valor.secoes.map((s, i) => (
        <details key={i} className="group rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-brand-lavanda/40">{nomeSecao(s.tipo)}</span>
              <span className="block truncate text-sm font-medium text-brand-lavanda">{s.titulo || '—'}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-brand-lavanda/40 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 px-4 pb-4">
            <Rotulo texto="Título" />
            <Input value={s.titulo} onChange={(e) => setSecao(i, { ...s, titulo: e.target.value })} />
            <Rotulo texto="Subtítulo" />
            <Input value={s.subtitulo} onChange={(e) => setSecao(i, { ...s, subtitulo: e.target.value })} />
            <Rotulo texto="Texto" />
            <Textarea rows={3} value={s.texto} onChange={(e) => setSecao(i, { ...s, texto: e.target.value })} />
            <Rotulo texto="Botão" />
            <Input value={s.botao} onChange={(e) => setSecao(i, { ...s, botao: e.target.value })} placeholder="Sem botão" />

            <div className="flex items-center justify-between pt-2">
              <Rotulo texto={`Itens (${s.itens.length})`} />
              <button
                type="button"
                onClick={() => setSecao(i, { ...s, itens: [...s.itens, { titulo: '', texto: '' }] })}
                className="flex items-center gap-1 text-xs text-brand-lavanda/50 hover:text-brand-lima"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>
            {s.itens.map((it, j) => (
              <div key={j} className="space-y-1.5 rounded-lg border border-white/[0.06] p-2.5">
                <div className="flex gap-2">
                  <Input value={it.titulo} placeholder="Título" onChange={(e) => setSecao(i, { ...s, itens: s.itens.map((x, k) => (k === j ? { ...x, titulo: e.target.value } : x)) })} />
                  <button
                    type="button"
                    onClick={() => setSecao(i, { ...s, itens: s.itens.filter((_, k) => k !== j) })}
                    aria-label="Remover item"
                    className="shrink-0 rounded-md px-2 text-brand-lavanda/30 hover:bg-brand-rosa/10 hover:text-brand-rosa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Textarea rows={2} value={it.texto} placeholder="Texto" onChange={(e) => setSecao(i, { ...s, itens: s.itens.map((x, k) => (k === j ? { ...x, texto: e.target.value } : x)) })} />
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

function Rotulo({ texto }: { texto: string }) {
  return <p className="text-[11px] text-brand-lavanda/50">{texto}</p>
}

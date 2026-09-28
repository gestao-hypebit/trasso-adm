'use client'

import { cn } from '@/lib/utils'
import type { Campo } from '@/lib/leads/formulario'

// Pré-visualização aproximada de como o formulário aparece no site
// (mesma paleta roxo/lima e inputs sublinhados do SITE).
export function FormularioPreview({ titulo, subtitulo, botao, campos }: { titulo: string; subtitulo: string; botao: string; campos: Campo[] }) {
  return (
    <div className="rounded-xl bg-[#1a0533] p-8 text-[#f7f2ff]">
      {titulo && <p className="text-center text-2xl font-black tracking-tight">{titulo}</p>}
      {subtitulo && <p className="mx-auto mt-3 max-w-sm text-center text-xs leading-relaxed text-[#f7f2ff]/60">{subtitulo}</p>}

      <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-6">
        {campos.map((c) => (
          <div key={c.id} className={cn(c.largura === 'inteira' ? 'col-span-2' : 'col-span-2 sm:col-span-1')}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#f7f2ff]/40">
              {c.rotulo}
              {!c.obrigatorio && <span className="ml-1 normal-case tracking-normal text-[#f7f2ff]/25">(opcional)</span>}
            </p>
            {c.tipo === 'opcoes' || c.tipo === 'multiplas' ? (
              <div className="flex flex-wrap gap-1.5">
                {(c.opcoes ?? []).filter(Boolean).map((o, i) => (
                  <span
                    key={o + i}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[11px] font-semibold',
                      i === 0 ? 'border-[#a8f300] bg-[#a8f300] text-[#1a0533]' : 'border-white/15 text-[#f7f2ff]/70'
                    )}
                  >
                    {o}
                  </span>
                ))}
              </div>
            ) : c.tipo === 'select' ? (
              <div className="flex justify-between border-b border-white/15 py-2 text-sm text-[#f7f2ff]/25">
                <span>{c.placeholder || 'Selecione'}</span>
                <span>▾</span>
              </div>
            ) : (
              <div className={cn('border-b border-white/15 py-2 text-sm text-[#f7f2ff]/25', c.tipo === 'textarea' && 'pb-8')}>
                {c.placeholder || ' '}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#a8f300] px-6 py-2.5 text-sm font-bold text-[#1a0533]">
          {botao || 'Enviar'} <span aria-hidden="true">→</span>
        </span>
      </div>
    </div>
  )
}

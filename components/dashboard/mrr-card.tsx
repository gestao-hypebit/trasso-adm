'use client'

import Link from 'next/link'
import { Repeat, ChevronRight, Loader2 } from 'lucide-react'
import { useRecorrencia } from '@/components/recorrencia/use-recorrencia'
import { LINHA_CORES } from '@/lib/financeiro/linhas'
import { nomeLinha } from '@/lib/recorrencia'
import { formatCurrency } from '@/lib/utils'

// MRR da agência (Catálogo Place + Serviços), com o mesmo cálculo da tela
// Financeiro → MRR e assinaturas. Clicar leva para lá.
export function MrrCard() {
  const r = useRecorrencia()
  const linhas = [r.catalogo, r.servicos]
  const bruto = r.catalogo.mrrBruto + r.servicos.mrrBruto
  const liquido = r.catalogo.mrr.mrr + r.servicos.mrr.mrr
  const inadimplentes = r.catalogo.inadimplentes + r.servicos.inadimplentes
  const carregando = r.loading || r.asaasCarregando

  return (
    <Link
      href="/financeiro/mrr"
      className="group flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-brand-violeta/[0.08] to-transparent p-5 transition-colors hover:border-white/[0.16]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-brand-lavanda/50">MRR da agência</p>
          <p className="text-3xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {r.loading ? '...' : formatCurrency(bruto)}
          </p>
          <p className="mt-1 text-xs text-brand-lavanda/30">
            {carregando
              ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> buscando no Asaas…</span>
              : <>Bruto · líquido {formatCurrency(liquido)} · ARR {formatCurrency(bruto * 12)}</>}
          </p>
        </div>
        <Repeat className="h-8 w-8 shrink-0 text-brand-violeta/30" />
      </div>

      <div className="space-y-2">
        {bruto > 0 && (
          <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.04]">
            {linhas.map((l) => (
              <div key={l.linha} style={{ width: `${(l.mrrBruto / bruto) * 100}%`, background: LINHA_CORES[l.linha] }} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {linhas.map((l) => (
            <span key={l.linha} className="flex items-center gap-1.5 text-brand-lavanda/60">
              <span className="h-2 w-2 rounded-sm" style={{ background: LINHA_CORES[l.linha] }} />
              {nomeLinha[l.linha]} <span className="font-medium text-brand-lavanda">{formatCurrency(l.mrrBruto)}</span>
              <span className="text-brand-lavanda/30">({l.ativas})</span>
            </span>
          ))}
          {inadimplentes > 0 && <span className="text-brand-rosa/80">{inadimplentes} inadimplente{inadimplentes === 1 ? '' : 's'}</span>}
          <ChevronRight className="ml-auto h-4 w-4 text-brand-lavanda/20 transition-colors group-hover:text-brand-lavanda/60" />
        </div>
      </div>
    </Link>
  )
}

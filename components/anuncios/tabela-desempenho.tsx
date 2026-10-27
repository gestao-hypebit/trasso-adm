'use client'

import { Fragment, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Resumo } from '@/lib/anuncios/regras'
import { cn, formatCurrency } from '@/lib/utils'

export type LinhaDesempenho = Resumo & { id: string; nome: string; extra?: React.ReactNode }

const int = (v: number) => v.toLocaleString('pt-BR')
const moeda = (v: number | null) => (v === null ? '—' : formatCurrency(v))
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(2).replace('.', ',')}%`)

const COLUNAS: { titulo: string; valor: (l: Resumo) => string; dica?: string }[] = [
  { titulo: 'Gasto', valor: (l) => formatCurrency(l.gasto) },
  { titulo: 'Impressões', valor: (l) => int(l.impressoes) },
  { titulo: 'Cliques', valor: (l) => int(l.cliques), dica: 'Cliques no link' },
  { titulo: 'CTR', valor: (l) => pct(l.ctr), dica: 'Cliques no link ÷ impressões' },
  { titulo: 'Cadastros', valor: (l) => int(l.cadastros), dica: 'Cadastros reais vindos do produto' },
  { titulo: 'Conv. Meta', valor: (l) => int(l.conversoesMeta), dica: 'Leads/cadastros que o próprio Meta reporta' },
  { titulo: 'Assinaturas', valor: (l) => int(l.assinaturas) },
  { titulo: 'Custo/cad.', valor: (l) => moeda(l.custoPorCadastro) },
  { titulo: 'CAC', valor: (l) => moeda(l.cac), dica: 'Gasto ÷ novos clientes pagantes' },
]

// Tabela por campanha; cada linha pode abrir as filhas (anúncios).
export function TabelaDesempenho({ linhas, filhas, vazio }: {
  linhas: LinhaDesempenho[]
  filhas?: (id: string) => LinhaDesempenho[]
  vazio: string
}) {
  const [aberta, setAberta] = useState<string | null>(null)
  if (!linhas.length) return <p className="py-10 text-center text-sm text-brand-lavanda/40">{vazio}</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-xs text-brand-lavanda/40">
            <th className="py-2 pr-3 font-normal">Nome</th>
            {COLUNAS.map((c) => <th key={c.titulo} title={c.dica} className="py-2 px-2 text-right font-normal whitespace-nowrap">{c.titulo}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const abrir = filhas && aberta === l.id
            return (
              <Fragment key={l.id}>
                <tr
                  onClick={filhas ? () => setAberta(abrir ? null : l.id) : undefined}
                  className={cn('border-b border-white/[0.04]', filhas && 'cursor-pointer hover:bg-white/[0.02]')}
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      {filhas && <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-brand-lavanda/30 transition-transform', abrir && 'rotate-90')} />}
                      <div className="min-w-0">
                        <p className="max-w-[320px] truncate text-brand-lavanda" title={l.nome}>{l.nome}</p>
                        {l.extra}
                      </div>
                    </div>
                  </td>
                  {COLUNAS.map((c) => <td key={c.titulo} className="py-2.5 px-2 text-right tabular-nums text-brand-lavanda/80 whitespace-nowrap">{c.valor(l)}</td>)}
                </tr>
                {abrir && filhas(l.id).map((f) => (
                  <tr key={f.id} className="border-b border-white/[0.03] bg-white/[0.015] text-xs">
                    <td className="py-2 pr-3 pl-8"><p className="max-w-[300px] truncate text-brand-lavanda/70" title={f.nome}>{f.nome}</p></td>
                    {COLUNAS.map((c) => <td key={c.titulo} className="py-2 px-2 text-right tabular-nums text-brand-lavanda/60 whitespace-nowrap">{c.valor(f)}</td>)}
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Ativa', cls: 'bg-brand-lima/10 text-brand-lima' },
  PAUSED: { label: 'Pausada', cls: 'bg-white/[0.06] text-brand-lavanda/60' },
  CAMPAIGN_PAUSED: { label: 'Pausada', cls: 'bg-white/[0.06] text-brand-lavanda/60' },
  ARCHIVED: { label: 'Arquivada', cls: 'bg-white/[0.04] text-brand-lavanda/40' },
  DELETED: { label: 'Excluída', cls: 'bg-white/[0.04] text-brand-lavanda/40' },
  WITH_ISSUES: { label: 'Com problemas', cls: 'bg-brand-rosa/10 text-brand-rosa' },
}

export function StatusCampanha({ status, orcamentoDiario, orcamentoTotal }: { status: string | null; orcamentoDiario: number | null; orcamentoTotal: number | null }) {
  const s = (status ? STATUS[status] : undefined) ?? { label: status ?? 'Sem status', cls: 'bg-white/[0.04] text-brand-lavanda/40' }
  const orc = orcamentoDiario ? `${formatCurrency(orcamentoDiario)}/dia` : orcamentoTotal ? `${formatCurrency(orcamentoTotal)} total` : null
  return (
    <p className="mt-0.5 flex items-center gap-2 text-[11px]">
      <span className={cn('rounded px-1.5 py-px', s.cls)}>{s.label}</span>
      {orc && <span className="text-brand-lavanda/40">{orc}</span>}
    </p>
  )
}

'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils'

export type Serie = { chave: string; nome: string; cor: string }

const fmtK = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : String(Math.round(v)))

// Gasto por dia; com várias séries, empilha (uma por marca) e mostra a legenda.
export function GraficoGasto({ dados, series }: { dados: Record<string, number | string>[]; series: Serie[] }) {
  const Dica = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const total = payload.reduce((s: number, p: any) => s + Number(p.value ?? 0), 0)
    return (
      <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl space-y-0.5">
        <p className="text-brand-lavanda/60 mb-1">{formatDate(label, "EEE, dd/MM")}</p>
        {series.length > 1 && [...payload].reverse().map((p: any) => (
          <p key={p.dataKey} className="flex items-center gap-2 text-brand-lavanda/80">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            {series.find((s) => s.chave === p.dataKey)?.nome}: {formatCurrency(Number(p.value))}
          </p>
        ))}
        <p className="font-semibold text-brand-lavanda">Total: {formatCurrency(total)}</p>
      </div>
    )
  }

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-lavanda/60">
          {series.map((s) => (
            <span key={s.chave} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} />{s.nome}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.15)" vertical={false} />
          <XAxis dataKey="dia" tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false}
            tickFormatter={(d) => formatDate(d, 'dd/MM')} minTickGap={16} />
          <YAxis tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={40} />
          <Tooltip content={<Dica />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          {series.map((s, i) => (
            <Bar key={s.chave} dataKey={s.chave} stackId="g" fill={s.cor} maxBarSize={24}
              // 2px de fundo entre segmentos; só o topo da pilha arredonda.
              stroke="#111015" strokeWidth={series.length > 1 ? 1 : 0}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

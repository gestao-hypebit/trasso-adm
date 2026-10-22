'use client'

import { useEffect, useRef } from 'react'
import { MessageCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { etapaDaRegua, mensagemCobranca } from '@/lib/automacoes/regras'
import { LINHA_CORES } from '@/lib/financeiro/linhas'
import { artigoLinha, nomeLinha } from '@/lib/recorrencia'
import { cn, formatCurrency, whatsappUrl } from '@/lib/utils'
import type { Recorrencia } from '@/components/recorrencia/use-recorrencia'

const corEtapa: Record<number, string> = {
  3: 'border-yellow-400/30 text-yellow-400',
  7: 'border-orange-400/30 text-orange-400',
  15: 'border-brand-rosa/40 text-brand-rosa',
}

// Régua de cobrança do dia: todos os inadimplentes das três linhas, do atraso
// mais antigo para o mais novo, com a mensagem de WhatsApp da etapa.
export function ParaCobrar({ r, foco }: { r: Recorrencia; foco?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const itens = r.linhas
    .flatMap((calc) => calc.linhas.filter((l) => !l.soNoAsaas && l.atraso > 0).map((l) => ({ ...l, linha: calc.linha })))
    .sort((a, b) => b.diasAtraso - a.diasAtraso)

  useEffect(() => {
    if (foco && itens.length) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [foco, itens.length])

  if (!itens.length) return null
  const total = itens.reduce((s, l) => s + l.atraso, 0)

  return (
    <div ref={ref}>
      <Card className={cn(foco && 'border-brand-rosa/30')}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Para cobrar · {itens.length} cliente{itens.length === 1 ? '' : 's'} · {formatCurrency(total)}</CardTitle>
          <p className="text-xs text-brand-lavanda/40">Régua: 3, 7 e 15 dias de atraso. A mensagem fica mais firme a cada etapa; o sino avisa quando alguém muda de etapa.</p>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-white/[0.04]">
            {itens.map((l) => {
              const etapa = etapaDaRegua(l.diasAtraso)
              const produto = l.linha === 'agencia' ? '' : ` ${artigoLinha(l.linha)} ${nomeLinha[l.linha]}`
              const wa = whatsappUrl(l.whatsapp, mensagemCobranca(l.nome, formatCurrency(l.atraso), l.diasAtraso, produto))
              return (
                <li key={`${l.linha}:${l.chave}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-brand-lavanda">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: LINHA_CORES[l.linha] }} title={nomeLinha[l.linha]} />
                      {l.nome}
                    </p>
                    <p className="text-xs text-brand-lavanda/40">{nomeLinha[l.linha]} · {formatCurrency(l.atraso)} · há {l.diasAtraso} dia{l.diasAtraso === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {etapa && (
                      <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', corEtapa[etapa])}>
                        {etapa === 15 ? '15+ dias' : `${etapa} dias`}
                      </span>
                    )}
                    {wa ? (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> Cobrar</a>
                      </Button>
                    ) : (
                      <span className="text-[11px] text-brand-lavanda/30">sem WhatsApp</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

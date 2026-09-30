'use client'

import { useEffect, useState } from 'react'
import { Copy, TrendingUp, TrendingDown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { FRENTES, nomeMes, somarMeses, type Frente, type MetaMensal } from '@/lib/metas/calculos'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mes: string
  metas: MetaMensal[]
  // Novos registrados no sistema no mês anterior, por frente.
  realizadoAnterior: Record<Frente, number>
  onSalvo: () => void
}

type Linha = { meta: string; base: string }

export function DefinirMetasDialog({ open, onOpenChange, mes, metas, realizadoAnterior, onSalvo }: Props) {
  const anterior = somarMeses(mes, -1)
  const [linhas, setLinhas] = useState<Record<Frente, Linha>>({} as Record<Frente, Linha>)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const metaDe = (m: string, f: Frente) => metas.find((x) => x.frente === f && x.competencia.startsWith(m))

  useEffect(() => {
    if (!open) return
    setErro(null)
    setLinhas(Object.fromEntries(FRENTES.map((f) => {
      const atual = metaDe(mes, f.value)
      return [f.value, { meta: atual ? String(atual.meta_novos) : '', base: atual?.base_anterior != null ? String(atual.base_anterior) : '' }]
    })) as Record<Frente, Linha>)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mes, metas])

  const temMetaAnterior = FRENTES.some((f) => metaDe(anterior, f.value))

  function copiarAnterior() {
    setLinhas((l) => Object.fromEntries(FRENTES.map((f) => {
      const ant = metaDe(anterior, f.value)
      return [f.value, { ...l[f.value], meta: ant ? String(ant.meta_novos) : l[f.value]?.meta ?? '' }]
    })) as Record<Frente, Linha>)
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    const rows = FRENTES.map((f) => ({
      competencia: `${mes}-01`,
      frente: f.value,
      meta_novos: parseInt(linhas[f.value]?.meta || '0', 10) || 0,
      base_anterior: linhas[f.value]?.base === '' ? null : parseInt(linhas[f.value].base, 10) || 0,
      updated_at: new Date().toISOString(),
    }))
    const db = createClient() as any
    const { error } = await db.from('metas_mensais').upsert(rows, { onConflict: 'competencia,frente' })
    setSalvando(false)
    if (error) { setErro(error.message); return }
    onSalvo()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">Metas de {nomeMes(mes)}</DialogTitle>
          <p className="text-xs text-brand-lavanda/50">Quantos clientes novos você quer fechar em cada frente?</p>
        </DialogHeader>

        <div className="space-y-3 mt-3">
          {FRENTES.map((f) => {
            const l = linhas[f.value] ?? { meta: '', base: '' }
            const doSistema = realizadoAnterior[f.value] ?? 0
            const base = doSistema > 0 ? doSistema : l.base === '' ? null : Number(l.base)
            const meta = Number(l.meta) || 0
            const cresc = base && meta ? (meta - base) / base : null
            return (
              <div key={f.value} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.cor }} />
                  <span className="text-sm font-semibold text-brand-lavanda">{f.label}</span>
                  <span className="text-[11px] text-brand-lavanda/40">· {f.descricao}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meta de clientes novos</Label>
                    <Input
                      type="number" min={0} placeholder="0" value={l.meta}
                      className="text-lg font-bold h-11"
                      onChange={(e) => setLinhas((s) => ({ ...s, [f.value]: { ...l, meta: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs capitalize">Realizado em {nomeMes(anterior, true)}</Label>
                    {doSistema > 0 ? (
                      <div className="h-11 flex items-center px-3 rounded-lg bg-white/[0.03] text-lg font-bold text-brand-lavanda/70" title="Calculado pelos registros do mês anterior">
                        {doSistema}
                      </div>
                    ) : (
                      <Input
                        type="number" min={0} placeholder="—" value={l.base}
                        className="h-11"
                        title="Sem registros no sistema para o mês anterior — informe à mão"
                        onChange={(e) => setLinhas((s) => ({ ...s, [f.value]: { ...l, base: e.target.value } }))}
                      />
                    )}
                  </div>
                </div>
                {cresc !== null && (
                  <p className={cn('mt-2 flex items-center gap-1 text-xs', cresc >= 0 ? 'text-brand-lima' : 'text-brand-rosa')}>
                    {cresc >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {cresc >= 0 ? '+' : ''}{Math.round(cresc * 100)}% em relação ao mês anterior
                  </p>
                )}
              </div>
            )
          })}

          {erro && <p className="text-xs text-brand-rosa">{erro}</p>}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
            {temMetaAnterior && (
              <Button variant="ghost" size="sm" onClick={copiarAnterior} className="gap-1.5 sm:mr-auto">
                <Copy className="h-3.5 w-3.5" /> Repetir metas de {nomeMes(anterior, true)}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:ml-auto">Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar metas'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, Plus, Trash2, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { calcularRentabilidade, corMargem } from '@/lib/financeiro/rentabilidade'
import { cn, formatCurrency, formatDate, toISODateLocal } from '@/lib/utils'

type Lancamento = { id: string; projeto_id: string | null; tipo: string; descricao: string; valor: number; data: string; status: string }
type Apontamento = { id: string; projeto_id: string; data: string; horas: number; descricao: string | null; profiles: { nome: string } | null }

const statusLanc: Record<string, { label: string; variant: 'ativo' | 'pendente' | 'inativo' | 'default' }> = {
  recebido: { label: 'Recebido', variant: 'ativo' },
  pago: { label: 'Pago', variant: 'ativo' },
  pendente: { label: 'Pendente', variant: 'pendente' },
  cancelado: { label: 'Cancelado', variant: 'inativo' },
}

export function RentabilidadeProjeto({ projetoId, valorProjeto, horasEstimadas }: {
  projetoId: string; valorProjeto: number | null; horasEstimadas: number | null
}) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([])
  const [custoHora, setCustoHora] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erroTabela, setErroTabela] = useState(false)
  const [horasOpen, setHorasOpen] = useState(false)
  const [form, setForm] = useState({ data: toISODateLocal(new Date()), horas: '', descricao: '' })
  const [salvando, setSalvando] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient() as any
    const [{ data: l }, { data: a, error: errA }, { data: cfg }] = await Promise.all([
      supabase.from('lancamentos').select('id, projeto_id, tipo, descricao, valor, data, status').eq('projeto_id', projetoId).order('data'),
      supabase.from('apontamentos_horas').select('id, projeto_id, data, horas, descricao, profiles(nome)').eq('projeto_id', projetoId).order('data', { ascending: false }),
      supabase.from('configuracoes_agencia').select('custo_hora').limit(1).maybeSingle(),
    ])
    setLancamentos(l ?? [])
    setApontamentos(a ?? [])
    setErroTabela(!!errA)
    setCustoHora(Number(cfg?.custo_hora ?? 0))
    setLoading(false)
  }, [projetoId])

  useEffect(() => { load() }, [load])

  async function registrarHoras() {
    const horas = Number(form.horas.replace(',', '.'))
    if (!horas || horas <= 0) return
    setSalvando(true)
    const supabase = createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('apontamentos_horas').insert({
      projeto_id: projetoId, usuario_id: user?.id ?? null, data: form.data, horas, descricao: form.descricao.trim() || null,
    })
    setSalvando(false)
    if (!error) {
      setHorasOpen(false)
      setForm({ data: toISODateLocal(new Date()), horas: '', descricao: '' })
      load()
    }
  }

  async function excluirApontamento(id: string) {
    setApontamentos((prev) => prev.filter((a) => a.id !== id))
    await (createClient() as any).from('apontamentos_horas').delete().eq('id', id)
  }

  if (loading) return <p className="text-sm text-brand-lavanda/40 py-8 text-center">Carregando...</p>

  const r = calcularRentabilidade(valorProjeto, lancamentos, apontamentos, custoHora)
  const horasPct = horasEstimadas ? Math.min(100, (r.horas / horasEstimadas) * 100) : null

  const kpis = [
    { label: 'Receita do projeto', valor: formatCurrency(r.receitaPrevista), sub: `${formatCurrency(r.receitaRecebida)} recebido`, cor: 'text-brand-lavanda' },
    { label: 'Custos diretos', valor: formatCurrency(r.custosDiretos), sub: 'despesas vinculadas', cor: 'text-brand-lavanda' },
    { label: 'Custo das horas', valor: formatCurrency(r.custoHoras), sub: `${r.horas.toLocaleString('pt-BR')}h × ${formatCurrency(custoHora)}`, cor: 'text-brand-lavanda' },
    { label: 'Lucro', valor: formatCurrency(r.lucro), sub: r.margem !== null ? `margem ${(r.margem * 100).toFixed(0)}%` : 'sem receita', cor: corMargem(r.margem) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-brand-lavanda/50">{k.label}</p>
              <p className={cn('text-xl font-bold mt-1', k.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>{k.valor}</p>
              <p className="text-[11px] text-brand-lavanda/40 mt-0.5">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(custoHora === 0 || erroTabela) && (
        <div className="flex gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-3 text-xs text-yellow-300/90">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            {erroTabela
              ? 'A tabela de horas ainda não existe. Rode a migration 20260924000000_rentabilidade_contratos.sql no Supabase.'
              : <>Defina o custo/hora da equipe em <Link href="/configuracoes" className="underline">Configurações</Link> para calcular o custo das horas.</>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm">Horas trabalhadas</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setHorasOpen(true)} disabled={erroTabela}><Plus className="h-3.5 w-3.5" /> Registrar horas</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-brand-lavanda">{r.horas.toLocaleString('pt-BR')}h</span>
              <span className="text-xs text-brand-lavanda/50">
                {horasEstimadas ? `de ${horasEstimadas}h estimadas` : 'sem estimativa'}
                {r.valorHoraEfetivo !== null && ` · ${formatCurrency(r.valorHoraEfetivo)}/h efetivo`}
              </span>
            </div>
            {horasPct !== null && (
              <div className="h-1.5 rounded-full bg-white/[0.06]">
                <div className={cn('h-1.5 rounded-full', horasPct >= 100 ? 'bg-brand-rosa' : 'bg-brand-violeta')} style={{ width: `${horasPct}%` }} />
              </div>
            )}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {apontamentos.length === 0 ? (
                <p className="text-xs text-brand-lavanda/40 py-4 text-center">Nenhuma hora registrada.</p>
              ) : apontamentos.map((a) => (
                <div key={a.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                  <Clock className="h-3.5 w-3.5 text-brand-violeta shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-brand-lavanda truncate">{a.descricao || 'Sem descrição'}</p>
                    <p className="text-[10px] text-brand-lavanda/40">{formatDate(a.data)}{a.profiles?.nome ? ` · ${a.profiles.nome}` : ''}</p>
                  </div>
                  <span className="text-xs font-semibold text-brand-lavanda">{Number(a.horas).toLocaleString('pt-BR')}h</span>
                  <button onClick={() => excluirApontamento(a.id)} className="opacity-0 group-hover:opacity-100 text-brand-lavanda/40 hover:text-brand-rosa" aria-label="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Lançamentos vinculados</CardTitle>
          </CardHeader>
          <CardContent>
            {lancamentos.length === 0 ? (
              <p className="text-xs text-brand-lavanda/40 py-4 text-center">
                Nenhum lançamento vinculado. Ao lançar receitas ou despesas no Financeiro, escolha este projeto.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {lancamentos.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-brand-lavanda truncate">{l.descricao}</p>
                      <p className="text-[10px] text-brand-lavanda/40">{formatDate(l.data)}</p>
                    </div>
                    <Badge variant={statusLanc[l.status]?.variant ?? 'default'}>{statusLanc[l.status]?.label ?? l.status}</Badge>
                    <span className={cn('text-xs font-semibold w-24 text-right', l.tipo === 'receita' ? 'text-brand-lima' : 'text-brand-rosa')}>
                      {l.tipo === 'receita' ? '+' : '−'}{formatCurrency(Number(l.valor))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={horasOpen} onOpenChange={setHorasOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar horas</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Horas</Label>
                <Input inputMode="decimal" placeholder="Ex: 2,5" value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} autoFocus />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>O que foi feito</Label>
              <Input placeholder="Ex: Layout da home" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setHorasOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={registrarHoras} disabled={salvando || !form.horas}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

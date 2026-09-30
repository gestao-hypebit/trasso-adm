'use client'

import { useEffect, useState } from 'react'
import { UserPlus, UserMinus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  CANAIS, FRENTES, MOTIVOS_SUGERIDOS, COR_CANCELAMENTO,
  type Frente, type Movimentacao, type TipoMov,
} from '@/lib/metas/calculos'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editando: Movimentacao | null
  dataPadrao: string
  tipoInicial?: TipoMov
  onSalvo: () => void
}

type Form = {
  tipo: TipoMov
  frente: Frente
  canal: string
  cliente_nome: string
  data: string
  valor: string
  motivo: string
  observacoes: string
}

export function MovimentacaoDialog({ open, onOpenChange, editando, dataPadrao, tipoInicial = 'novo', onSalvo }: Props) {
  const vazio = (): Form => ({
    tipo: tipoInicial, frente: 'catalogo_place', canal: 'captacao_ativa',
    cliente_nome: '', data: dataPadrao, valor: '', motivo: '', observacoes: '',
  })
  const [form, setForm] = useState<Form>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [registrados, setRegistrados] = useState(0)

  useEffect(() => {
    if (!open) return
    setErro(null)
    setRegistrados(0)
    setForm(editando ? {
      tipo: editando.tipo,
      frente: editando.frente,
      canal: editando.canal ?? 'captacao_ativa',
      cliente_nome: editando.cliente_nome,
      data: editando.data,
      valor: editando.valor ? String(editando.valor) : '',
      motivo: editando.motivo ?? '',
      observacoes: editando.observacoes ?? '',
    } : vazio())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editando])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const isNovo = form.tipo === 'novo'

  async function salvar(continuar: boolean) {
    if (!form.cliente_nome.trim()) { setErro('Informe o nome do cliente.'); return }
    if (!form.data) { setErro('Informe a data.'); return }
    setSalvando(true)
    setErro(null)
    const payload = {
      tipo: form.tipo,
      frente: form.frente,
      canal: isNovo ? form.canal : null,
      cliente_nome: form.cliente_nome.trim(),
      data: form.data,
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      motivo: isNovo ? null : form.motivo.trim() || null,
      observacoes: form.observacoes.trim() || null,
    }
    const db = createClient() as any
    const { error } = editando
      ? await db.from('metas_movimentacoes').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editando.id)
      : await db.from('metas_movimentacoes').insert(payload)
    setSalvando(false)
    if (error) { setErro(error.message); return }
    onSalvo()
    if (continuar) {
      // Mantém tipo, frente, canal e data — agiliza lançar vários em sequência.
      setForm((f) => ({ ...f, cliente_nome: '', valor: '', motivo: '', observacoes: '' }))
      setRegistrados((n) => n + 1)
    } else {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar movimentação' : 'Registrar movimentação'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: 'novo', label: 'Cliente novo', sub: 'Conta para a meta', Icon: UserPlus, cor: '#B8F000' },
              { v: 'cancelamento', label: 'Cancelamento', sub: 'Saiu da base', Icon: UserMinus, cor: COR_CANCELAMENTO },
            ] as const).map(({ v, label, sub, Icon, cor }) => {
              const ativo = form.tipo === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('tipo', v)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                    ativo ? 'bg-white/[0.06]' : 'border-white/[0.08] hover:bg-white/[0.03]',
                  )}
                  style={ativo ? { borderColor: cor } : undefined}
                >
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: ativo ? `${cor}22` : 'rgba(255,255,255,0.04)' }}>
                    <Icon className="h-4 w-4" style={{ color: ativo ? cor : 'rgba(232,228,248,0.4)' }} />
                  </div>
                  <div>
                    <p className={cn('text-sm font-semibold', ativo ? 'text-brand-lavanda' : 'text-brand-lavanda/60')}>{label}</p>
                    <p className="text-[11px] text-brand-lavanda/40">{sub}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Frente */}
          <div className="space-y-2">
            <Label>Frente</Label>
            <div className="grid grid-cols-2 gap-2">
              {FRENTES.map((f) => {
                const ativo = form.frente === f.value
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => set('frente', f.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all',
                      ativo ? 'bg-white/[0.06] text-brand-lavanda' : 'border-white/[0.08] text-brand-lavanda/50 hover:bg-white/[0.03]',
                    )}
                    style={ativo ? { borderColor: f.cor } : undefined}
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: f.cor }} />
                    <span className="font-medium">{f.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px]">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input
                autoFocus
                placeholder="Ex: Studio Fit Academia"
                value={form.cliente_nome}
                onChange={(e) => set('cliente_nome', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') salvar(false) }}
              />
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => set('data', e.target.value)} />
            </div>
          </div>

          {isNovo ? (
            <div className="space-y-2">
              <Label>Como chegou?</Label>
              <div className="flex flex-wrap gap-2">
                {CANAIS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => set('canal', c.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-all',
                      form.canal === c.value
                        ? 'border-brand-lima/60 bg-brand-lima/10 text-brand-lima'
                        : 'border-white/[0.1] text-brand-lavanda/50 hover:text-brand-lavanda/80',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Motivo do cancelamento</Label>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS_SUGERIDOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('motivo', m)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-all',
                      form.motivo === m
                        ? 'border-brand-rosa/60 bg-brand-rosa/10 text-brand-rosa'
                        : 'border-white/[0.1] text-brand-lavanda/50 hover:text-brand-lavanda/80',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Input placeholder="Ou escreva o motivo" value={form.motivo} onChange={(e) => set('motivo', e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label>{form.frente === 'catalogo_place' ? 'Mensalidade (R$)' : 'Valor do serviço (R$)'}</Label>
            <Input inputMode="decimal" placeholder="0,00" value={form.valor} onChange={(e) => set('valor', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              placeholder={isNovo ? 'Ex: Fechado via Instagram' : 'Ex: Cancelou depois de 2 meses'}
              value={form.observacoes}
              onChange={(e) => set('observacoes', e.target.value)}
            />
          </div>

          {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
          {registrados > 0 && !erro && (
            <p className="text-xs text-brand-lima">✓ {registrados} registrado{registrados > 1 ? 's' : ''}. Pode lançar o próximo.</p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {registrados > 0 ? 'Fechar' : 'Cancelar'}
            </Button>
            {!editando && (
              <Button variant="outline" onClick={() => salvar(true)} disabled={salvando}>
                Salvar e lançar outro
              </Button>
            )}
            <Button onClick={() => salvar(false)} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

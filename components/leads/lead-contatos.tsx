'use client'

import { useEffect, useState } from 'react'
import { Loader2, PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import { diaSP, somarDias } from '@/lib/anuncios/regras'
import {
  labelTipoContato, resultadoContato, resultadoContatoOpcoes, tipoContatoOpcoes, type LeadContato,
} from '@/lib/leads/contatos'
import type { Lead } from '@/components/leads/lead-detalhe-dialog'

const ATALHOS = [
  { dias: 1, label: 'Amanhã' },
  { dias: 3, label: '3 dias' },
  { dias: 7, label: '1 semana' },
]

const VAZIO = { tipo: 'whatsapp', resultado: 'sem_resposta', nota: '', proximo: '' }

// Histórico de tentativas de contato do lead + registro rápido de uma nova.
// Registrar já marca o próximo contato (vazio = sem próximo) e tira o lead de "Novo".
export function LeadContatos({ lead, atualizar, onRegistrado }: {
  lead: Lead
  atualizar: (campos: Partial<Lead>) => Promise<boolean>
  onRegistrado?: (contato: LeadContato) => void
}) {
  const [contatos, setContatos] = useState<LeadContato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const hoje = diaSP(new Date())

  useEffect(() => {
    setForm(VAZIO)
    setErro(null)
    setCarregando(true)
    ;(createClient() as any)
      .from('lead_contatos')
      .select('id, lead_id, tipo, resultado, nota, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }: { data: LeadContato[] | null; error: unknown }) => {
        if (error) setErro('Não foi possível carregar os contatos. A migration de contatos já foi aplicada no Supabase?')
        setContatos(data ?? [])
        setCarregando(false)
      })
  }, [lead.id])

  async function registrar() {
    setSalvando(true)
    setErro(null)
    const { data, error } = await (createClient() as any)
      .from('lead_contatos')
      .insert({ lead_id: lead.id, tipo: form.tipo, resultado: form.resultado, nota: form.nota.trim() || null })
      .select('id, lead_id, tipo, resultado, nota, created_at')
      .single()
    if (error || !data) {
      setErro('Não foi possível registrar o contato.')
      setSalvando(false)
      return
    }
    setContatos((prev) => [data as LeadContato, ...prev])
    onRegistrado?.(data as LeadContato)
    await atualizar({
      proximo_contato: form.proximo || null,
      ...(lead.status === 'novo' ? { status: 'em_contato' } : {}),
      ...(form.resultado === 'agendou' && ['novo', 'em_contato'].includes(lead.status) ? { status: 'qualificado' } : {}),
    })
    setForm(VAZIO)
    setSalvando(false)
  }

  return (
    <div className="mt-5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-lavanda">
        <PhoneCall className="h-3.5 w-3.5 text-brand-lima" /> Contatos
        <span className="text-xs font-normal text-brand-lavanda/40">
          {contatos.length} {contatos.length === 1 ? 'toque' : 'toques'}
        </span>
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Select value={form.tipo} onValueChange={(tipo) => setForm((f) => ({ ...f, tipo }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {tipoContatoOpcoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={form.resultado} onValueChange={(resultado) => setForm((f) => ({ ...f, resultado }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {resultadoContatoOpcoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          className="sm:col-span-2"
          value={form.nota}
          onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
          placeholder="O que rolou? (opcional)"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Falar de novo em</Label>
          <Input type="date" className="w-[160px]" value={form.proximo} min={hoje} onChange={(e) => setForm((f) => ({ ...f, proximo: e.target.value }))} />
        </div>
        {ATALHOS.map((a) => {
          const dia = somarDias(hoje, a.dias)
          return (
            <button
              key={a.dias}
              type="button"
              onClick={() => setForm((f) => ({ ...f, proximo: f.proximo === dia ? '' : dia }))}
              className={cn(
                'h-9 rounded-md border px-2.5 text-xs',
                form.proximo === dia ? 'border-brand-lima bg-brand-lima/20 text-brand-lima' : 'border-white/[0.1] text-brand-lavanda/60 hover:text-brand-lavanda'
              )}
            >{a.label}</button>
          )
        })}
        <Button size="sm" className="ml-auto" onClick={registrar} disabled={salvando}>
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar contato'}
        </Button>
      </div>
      {!form.proximo && (
        <p className="mt-1.5 text-[11px] text-brand-lavanda/40">Sem data, o lead fica sem próximo contato marcado.</p>
      )}

      {erro && <p className="mt-2 text-xs text-brand-rosa">{erro}</p>}

      {carregando ? (
        <p className="mt-4 text-xs text-brand-lavanda/40">Carregando…</p>
      ) : contatos.length > 0 && (
        <ol className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
          {contatos.map((c) => {
            const r = resultadoContato(c.resultado)
            return (
              <li key={c.id} className="text-xs">
                <span className="text-brand-lavanda/40">{formatDate(c.created_at, "dd/MM 'às' HH:mm")}</span>
                {' · '}<span className="text-brand-lavanda/80">{labelTipoContato(c.tipo)}</span>
                {' · '}<span className={r.classe}>{r.label}</span>
                {c.nota && <p className="mt-0.5 text-brand-lavanda/60">{c.nota}</p>}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, MessageCircle, UserPlus, Trash2, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { formatDate, whatsappUrl } from '@/lib/utils'
import { formatarValor, leadStatusConfig, type Resposta } from '@/lib/leads/formulario'

export type Lead = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  empresa: string | null
  respostas: Resposta[]
  status: string
  origem: string
  pagina: string | null
  utm: Record<string, string> | null
  cliente_id: string | null
  observacoes: string | null
  created_at: string
  formularios: { nome: string } | null
}

// Respostas que já aparecem no cabeçalho não se repetem na lista.
const CHAVES_CABECALHO = ['nome', 'email', 'telefone', 'empresa']

interface Props {
  lead: Lead | null
  onOpenChange: (open: boolean) => void
  onChange: (lead: Lead) => void
  onDelete: (id: string) => void
}

export function LeadDetalheDialog({ lead, onOpenChange, onChange, onDelete }: Props) {
  const router = useRouter()
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  useEffect(() => {
    setObservacoes(lead?.observacoes ?? '')
    setErro(null)
    setConfirmarExclusao(false)
  }, [lead?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!lead) return null
  const atual = lead

  async function atualizar(campos: Partial<Lead>) {
    setErro(null)
    const { error } = await (createClient() as any)
      .from('leads')
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq('id', atual.id)
    if (error) {
      setErro('Não foi possível salvar.')
      return false
    }
    onChange({ ...atual, ...campos })
    return true
  }

  async function converterEmCliente() {
    setSalvando(true)
    setErro(null)
    const supabase = createClient() as any
    const detalhes = atual.respostas
      .filter((r) => !CHAVES_CABECALHO.includes(r.chave))
      .map((r) => `${r.rotulo}: ${formatarValor(r.valor)}`)
      .join('\n')

    const { data: cliente, error } = await supabase
      .from('clientes')
      .insert({
        nome: atual.nome,
        empresa: atual.empresa,
        email: atual.email,
        telefone: atual.telefone,
        whatsapp: atual.telefone,
        origem: 'site',
        status: 'lead',
        tipo: 'agencia',
        observacoes: [`Lead do site em ${formatDate(atual.created_at)}`, detalhes, atual.observacoes].filter(Boolean).join('\n\n'),
      })
      .select('id')
      .single()

    if (error || !cliente) {
      setErro('Não foi possível criar o cliente.')
      setSalvando(false)
      return
    }
    await atualizar({ status: 'convertido', cliente_id: cliente.id })
    setSalvando(false)
    router.push(`/clientes/${cliente.id}`)
  }

  async function excluir() {
    if (!confirmarExclusao) {
      setConfirmarExclusao(true)
      return
    }
    const { error } = await (createClient() as any).from('leads').delete().eq('id', atual.id)
    if (error) {
      setErro('Não foi possível excluir.')
      return
    }
    onDelete(atual.id)
  }

  // Chamar o lead no WhatsApp/e-mail já o tira da caixa de "novos".
  function marcarContato() {
    if (atual.status === 'novo') atualizar({ status: 'em_contato' })
  }

  const whatsapp = whatsappUrl(atual.telefone, `Oi ${atual.nome.split(' ')[0]}! Aqui é da Trasso, recebemos seu contato pelo site.`)
  const extras = atual.respostas.filter((r) => !CHAVES_CABECALHO.includes(r.chave))
  const utm = atual.utm ? Object.entries(atual.utm) : []

  return (
    <Dialog open={!!lead} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{atual.nome}</DialogTitle>
          <DialogDescription>
            {[atual.empresa, atual.formularios?.nome, formatDate(atual.created_at, "dd/MM/yyyy 'às' HH:mm")].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-wrap gap-2">
          {whatsapp && (
            <Button size="sm" asChild>
              <a href={whatsapp} target="_blank" rel="noreferrer" onClick={marcarContato}><MessageCircle className="h-3.5 w-3.5" /> {atual.telefone}</a>
            </Button>
          )}
          {atual.email && (
            <Button size="sm" variant="outline" asChild>
              <a href={`mailto:${atual.email}`} onClick={marcarContato}><Mail className="h-3.5 w-3.5" /> {atual.email}</a>
            </Button>
          )}
        </div>

        {extras.length > 0 && (
          <dl className="mt-5 space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            {extras.map((r) => (
              <div key={r.chave}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-brand-lavanda/40">{r.rotulo}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-brand-lavanda">
                  {Array.isArray(r.valor) ? (
                    <span className="flex flex-wrap gap-1.5">
                      {r.valor.map((v) => (
                        <span key={v} className="rounded-full bg-brand-violeta/15 px-2 py-0.5 text-xs text-brand-lavanda/90">{v}</span>
                      ))}
                    </span>
                  ) : r.valor}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={atual.status} onValueChange={(status) => atualizar({ status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(leadStatusConfig).map(([key, sc]) => (
                  <SelectItem key={key} value={key}>{sc.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-obs">Anotações internas</Label>
            <Textarea
              id="lead-obs"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              onBlur={() => observacoes !== (atual.observacoes ?? '') && atualizar({ observacoes: observacoes || null })}
              placeholder="Ex.: liguei dia 12, pediu proposta até sexta"
            />
          </div>
        </div>

        {(atual.pagina || utm.length > 0) && (
          <p className="mt-4 text-[11px] text-brand-lavanda/40">
            {atual.pagina && <>Página: {atual.pagina}</>}
            {utm.length > 0 && <> · {utm.map(([k, v]) => `${k}=${v}`).join(' · ')}</>}
          </p>
        )}

        {erro && <p className="mt-3 text-xs text-brand-rosa">{erro}</p>}

        <div className="mt-6 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
          <Button variant="ghost" size="sm" onClick={excluir} className="text-brand-rosa/70 hover:text-brand-rosa">
            <Trash2 className="h-3.5 w-3.5" /> {confirmarExclusao ? 'Clique de novo para excluir' : 'Excluir'}
          </Button>
          {atual.cliente_id ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/clientes/${atual.cliente_id}`}><ExternalLink className="h-3.5 w-3.5" /> Ver cliente</Link>
            </Button>
          ) : (
            <Button size="sm" variant="violeta" onClick={converterEmCliente} disabled={salvando}>
              <UserPlus className="h-3.5 w-3.5" /> {salvando ? 'Convertendo…' : 'Converter em cliente'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowRight, CalendarPlus, Check, ExternalLink, FileText, FolderPlus, Loader2, MessageCircle, RotateCcw, Video, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { cn, whatsappUrl } from '@/lib/utils'
import { diaSP, somarDias } from '@/lib/anuncios/regras'
import { leadStatusConfig, type LeadStatus } from '@/lib/leads/formulario'
import { ETAPAS_FUNIL } from '@/lib/leads/funil'
import { labelFrenteLead } from '@/lib/leads/frente'
import { mensagemWhatsapp, proximoPasso } from '@/lib/leads/proximo-passo'
import type { Lead } from '@/components/leads/lead-detalhe-dialog'

type Reuniao = { id: string; data_inicio: string; link_meet: string | null }
type Proposta = { id: string; numero: string | null; status: string }

const DURACOES = [
  { min: '30', label: '30 min' },
  { min: '45', label: '45 min' },
  { min: '60', label: '1 hora' },
  { min: '90', label: '1h30' },
]

const quandoPadrao = () => format(addDays(new Date(), 1), "yyyy-MM-dd'T'10:00")
const dataReuniao = (iso: string) => format(new Date(iso), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })

// Barra de etapas do funil + o atalho certo para a etapa em que o lead está.
export function ProximoPasso({ lead, atualizar, garantirCliente, marcarContato }: {
  lead: Lead
  atualizar: (campos: Partial<Lead>) => Promise<boolean>
  garantirCliente: () => Promise<string | null>
  marcarContato: () => void
}) {
  const router = useRouter()
  const [reuniao, setReuniao] = useState<Reuniao | null>(null)
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [google, setGoogle] = useState(false)
  const [agendar, setAgendar] = useState(false)
  const [form, setForm] = useState({ quando: quandoPadrao(), duracao: '60', noGoogle: true, meet: true })
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const hoje = diaSP(new Date())

  useEffect(() => {
    setAgendar(false)
    setErro(null)
    setReuniao(null)
    const supabase = createClient() as any
    // Reunião que ainda vai acontecer (ou começou há pouco).
    supabase.from('eventos').select('id, data_inicio, link_meet')
      .eq('lead_id', lead.id)
      .gte('data_inicio', new Date(Date.now() - 3 * 3_600_000).toISOString())
      .order('data_inicio').limit(1)
      .then(({ data }: { data: Reuniao[] | null }) => setReuniao(data?.[0] ?? null))
  }, [lead.id])

  useEffect(() => {
    setProposta(null)
    if (!lead.cliente_id) return
    ;(createClient() as any).from('propostas').select('id, numero, status')
      .eq('cliente_id', lead.cliente_id)
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }: { data: Proposta[] | null }) => setProposta(data?.[0] ?? null))
  }, [lead.cliente_id])

  useEffect(() => {
    fetch('/api/google-calendar/status').then((r) => r.json()).then((s) => setGoogle(!!s.connected)).catch(() => setGoogle(false))
  }, [])

  async function executar(chave: string, fn: () => Promise<unknown>) {
    setOcupado(chave)
    setErro(null)
    try { await fn() } finally { setOcupado(null) }
  }

  async function marcarReuniao() {
    if (!form.quando) { setErro('Escolha o dia e o horário.'); return }
    const inicio = new Date(form.quando)
    const fim = new Date(inicio.getTime() + Number(form.duracao) * 60_000)
    const supabase = createClient() as any
    const { data: evento, error } = await supabase
      .from('eventos')
      .insert({
        titulo: `Reunião — ${lead.empresa || lead.nome}`,
        tipo: 'reuniao',
        cliente_id: lead.cliente_id,
        lead_id: lead.id,
        data_inicio: inicio.toISOString(),
        data_fim: fim.toISOString(),
        descricao: [
          `Lead: ${lead.nome}${lead.empresa ? ` (${lead.empresa})` : ''}`,
          lead.telefone && `WhatsApp: ${lead.telefone}`,
          lead.email && `E-mail: ${lead.email}`,
          `No CRM: ${window.location.origin}/leads?lead=${lead.id}`,
        ].filter(Boolean).join('\n'),
      })
      .select('id, data_inicio, link_meet')
      .single()
    if (error || !evento) {
      setErro('Não foi possível marcar a reunião. A migration de eventos do lead já foi aplicada no Supabase?')
      return
    }

    let marcada = evento as Reuniao
    if (google && form.noGoogle) {
      const res = await fetch('/api/google-calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento_id: marcada.id, gerar_meet: form.meet }),
      })
      const r = await res.json().catch(() => ({}))
      if (res.ok) marcada = { ...marcada, link_meet: r.link_meet ?? null }
      else setErro(r.error ?? 'A reunião foi salva na agenda da Slick, mas não no Google Agenda.')
    }

    setReuniao(marcada)
    setAgendar(false)
    const antesDaReuniao = ['novo', 'em_contato'].includes(lead.status)
    await atualizar({ proximo_contato: diaSP(inicio), ...(antesDaReuniao ? { status: 'qualificado' } : {}) })
  }

  async function criarProposta() {
    const clienteId = lead.cliente_id ?? await garantirCliente()
    if (clienteId) router.push(`/propostas/nova?cliente=${clienteId}&lead=${lead.id}`)
  }

  async function criarProjeto() {
    const clienteId = lead.cliente_id ?? await garantirCliente()
    if (clienteId) router.push(`/projetos/novo?cliente=${clienteId}`)
  }

  const passo = proximoPasso(lead.status)
  const indiceAtual = ETAPAS_FUNIL.indexOf(lead.status as LeadStatus)
  const marca = labelFrenteLead(lead.frente)
  const zap = (texto: string) => whatsappUrl(lead.telefone, texto)
  const carregando = (chave: string) => ocupado === chave && <Loader2 className="h-3.5 w-3.5 animate-spin" />

  const zapReuniao = reuniao && zap(mensagemWhatsapp.confirmarReuniao(lead.nome, dataReuniao(reuniao.data_inicio), reuniao.link_meet))
  const zapPrimeiro = zap(mensagemWhatsapp.primeiroContato(lead.nome, marca))
  const zapCobrar = zap(mensagemWhatsapp.cobrarProposta(lead.nome))

  const botaoAgendar = (variant: 'violeta' | 'outline') => (
    <Button size="sm" variant={variant} onClick={() => { setForm((f) => ({ ...f, quando: quandoPadrao() })); setAgendar((v) => !v) }}>
      <CalendarPlus className="h-3.5 w-3.5" /> {reuniao ? 'Remarcar reunião' : 'Agendar reunião'}
    </Button>
  )

  return (
    <div className="mt-4 rounded-xl border border-brand-violeta/25 bg-brand-violeta/[0.06] p-4">
      {/* Etapas: clicar move o lead. */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {ETAPAS_FUNIL.map((etapa, i) => {
          const feita = lead.status !== 'descartado' && i < indiceAtual
          const atual = etapa === lead.status
          return (
            <div key={etapa} className="flex items-center gap-1 shrink-0">
              {i > 0 && <span className={cn('h-px w-3 sm:w-5', feita || atual ? 'bg-brand-lima/60' : 'bg-white/[0.1]')} />}
              <button
                type="button"
                onClick={() => !atual && atualizar({ status: etapa, motivo_perda: null })}
                title={atual ? 'Etapa atual' : `Mover para ${leadStatusConfig[etapa].label}`}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors',
                  atual ? 'bg-brand-lima text-brand-noite font-semibold'
                    : feita ? 'bg-brand-lima/15 text-brand-lima hover:bg-brand-lima/25'
                      : 'bg-white/[0.04] text-brand-lavanda/50 hover:bg-white/[0.08] hover:text-brand-lavanda'
                )}
              >
                {feita && <Check className="h-3 w-3" />}
                {leadStatusConfig[etapa].label}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-brand-lavanda/40">
          {lead.status === 'descartado' ? 'Lead perdido' : 'Próximo passo'}
        </p>
        {passo && <p className="mt-0.5 text-sm font-semibold text-brand-lavanda">{passo}</p>}
        {lead.status === 'descartado' && (
          <p className="mt-0.5 text-sm text-brand-lavanda/70">{lead.motivo_perda ?? 'Sem motivo informado'}. Dá para tentar de novo mais pra frente.</p>
        )}
      </div>

      {reuniao && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-brand-lavanda/80">
          <Video className="h-3.5 w-3.5 text-brand-violeta" />
          Reunião {dataReuniao(reuniao.data_inicio)}
          <span className="ml-auto flex flex-wrap gap-1.5">
            {reuniao.link_meet && (
              <Button size="sm" variant="outline" className="h-7" asChild>
                <a href={reuniao.link_meet} target="_blank" rel="noreferrer"><Video className="h-3 w-3" /> Meet</a>
              </Button>
            )}
            {zapReuniao && (
              <Button size="sm" variant="outline" className="h-7" asChild>
                <a href={zapReuniao} target="_blank" rel="noreferrer"><MessageCircle className="h-3 w-3" /> Confirmar no WhatsApp</a>
              </Button>
            )}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {lead.status === 'novo' && (
          <>
            {zapPrimeiro && (
              <Button size="sm" variant="violeta" asChild>
                <a href={zapPrimeiro} target="_blank" rel="noreferrer" onClick={marcarContato}><MessageCircle className="h-3.5 w-3.5" /> Chamar no WhatsApp</a>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => executar('contato', () => atualizar({ status: 'em_contato' }))}>
              {carregando('contato')} Já falei <ArrowRight className="h-3.5 w-3.5" /> Em contato
            </Button>
            {botaoAgendar('outline')}
          </>
        )}

        {lead.status === 'em_contato' && botaoAgendar('violeta')}

        {lead.status === 'qualificado' && (
          <>
            <Button size="sm" variant="violeta" onClick={() => executar('proposta', criarProposta)} disabled={!!ocupado}>
              {carregando('proposta') || <FileText className="h-3.5 w-3.5" />} Criar proposta
            </Button>
            {botaoAgendar('outline')}
          </>
        )}

        {lead.status === 'proposta' && (
          <>
            {proposta ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/propostas/${proposta.id}`}><FileText className="h-3.5 w-3.5" /> Ver proposta{proposta.numero ? ` ${proposta.numero}` : ''}</Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => executar('proposta', criarProposta)} disabled={!!ocupado}>
                {carregando('proposta') || <FileText className="h-3.5 w-3.5" />} Criar proposta
              </Button>
            )}
            {zapCobrar && (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={zapCobrar}
                  target="_blank"
                  rel="noreferrer"
                  title="Abre o WhatsApp e marca o próximo contato para daqui a 3 dias"
                  onClick={() => atualizar({ proximo_contato: somarDias(hoje, 3) })}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Cobrar retorno
                </a>
              </Button>
            )}
            <Button size="sm" onClick={() => executar('ganhou', () => atualizar({ status: 'convertido', proximo_contato: null }))} disabled={!!ocupado}>
              {carregando('ganhou') || <Check className="h-3.5 w-3.5" />} Fechou
            </Button>
            <Button size="sm" variant="destructive" onClick={() => executar('perdeu', () => atualizar({ status: 'descartado', proximo_contato: null }))} disabled={!!ocupado}>
              <X className="h-3.5 w-3.5" /> Perdeu
            </Button>
          </>
        )}

        {lead.status === 'convertido' && (
          <>
            <Button size="sm" variant="violeta" onClick={() => executar('projeto', criarProjeto)} disabled={!!ocupado}>
              {carregando('projeto') || <FolderPlus className="h-3.5 w-3.5" />} Criar projeto
            </Button>
            {lead.cliente_id && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/clientes/${lead.cliente_id}`}><ExternalLink className="h-3.5 w-3.5" /> Ver cliente</Link>
              </Button>
            )}
          </>
        )}

        {lead.status === 'descartado' && (
          <>
            <Button size="sm" variant="outline" onClick={() => executar('retomar', () => atualizar({ status: 'em_contato', motivo_perda: null, proximo_contato: somarDias(hoje, 30) }))}>
              <RotateCcw className="h-3.5 w-3.5" /> Tentar de novo em 30 dias
            </Button>
            <Button size="sm" variant="ghost" onClick={() => executar('reabrir', () => atualizar({ status: 'em_contato', motivo_perda: null, proximo_contato: hoje }))}>
              Reabrir agora
            </Button>
          </>
        )}
      </div>

      {agendar && (
        <div className="mt-3 grid gap-3 rounded-lg border border-white/[0.06] bg-brand-noite/40 p-3 sm:grid-cols-[1fr_120px]">
          <div>
            <Label className="mb-1.5 block text-xs">Dia e horário</Label>
            <Input type="datetime-local" value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Duração</Label>
            <Select value={form.duracao} onValueChange={(duracao) => setForm({ ...form, duracao })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURACOES.map((d) => <SelectItem key={d.min} value={d.min}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {google && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-brand-lavanda/80">
                <input type="checkbox" className="accent-brand-lima" checked={form.noGoogle} onChange={(e) => setForm({ ...form, noGoogle: e.target.checked })} />
                Salvar no Google Agenda
              </label>
              {form.noGoogle && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-brand-lavanda/80">
                  <input type="checkbox" className="accent-brand-lima" checked={form.meet} onChange={(e) => setForm({ ...form, meet: e.target.checked })} />
                  Gerar link do Meet
                </label>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button size="sm" variant="ghost" onClick={() => setAgendar(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => executar('agendar', marcarReuniao)} disabled={!!ocupado}>
              {carregando('agendar') || <CalendarPlus className="h-3.5 w-3.5" />} Marcar reunião
            </Button>
          </div>
        </div>
      )}

      {erro && <p className="mt-2 text-xs text-brand-rosa">{erro}</p>}
    </div>
  )
}

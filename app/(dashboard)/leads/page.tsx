'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  closestCorners, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Search, Inbox, Plus, Columns3, List, Clock, CalendarClock, PhoneCall, MessageCircle, ArrowRight } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LeadDetalheDialog, LEAD_SELECT, type Lead } from '@/components/leads/lead-detalhe-dialog'
import { NovoLeadDialog } from '@/components/leads/novo-lead-dialog'
import { LeadsSubNav } from '@/components/leads/leads-sub-nav'
import { corFrenteLead, frenteLeadOpcoes, labelFrenteLead, type FrenteLead } from '@/lib/leads/frente'
import { contatoPendente, situacaoContato } from '@/lib/leads/contatos'
import { diaSP, somarDias } from '@/lib/anuncios/regras'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, formatDate, formatRelative, whatsappUrl } from '@/lib/utils'
import { mensagemWhatsapp, proximoPasso } from '@/lib/leads/proximo-passo'
import { formatarValor, leadStatusConfig, type LeadStatus } from '@/lib/leads/formulario'
import { canalDoLead, motivoPerdaOpcoes, taxa, type Historico } from '@/lib/leads/funil'
import { intervaloAnterior, intervaloDoPeriodo, noIntervalo, periodoOpcoes, type PeriodoChave } from '@/lib/leads/periodo'
import { ResumoLeads } from '@/components/leads/resumo-leads'
import { ehTrafegoPago, pontuacaoDoLead, TEMPERATURAS, temperaturaConfig, temperaturaDoLead, type Temperatura } from '@/lib/leads/trafego'
import { TemperaturaBadge } from '@/components/leads/temperatura-badge'

// Respostas que já aparecem em outro lugar da tabela (cabeçalho ou selo de temperatura).
const CHAVES_FORA_DO_RESUMO = ['nome', 'email', 'telefone', 'empresa', 'classificacao', 'pontuacao']

// Resumo curto do que o lead escreveu/escolheu, para a tabela.
function resumo(lead: Lead) {
  const r =
    lead.respostas.find((r) => Array.isArray(r.valor)) ??
    lead.respostas.find((r) => r.chave === 'mensagem') ??
    lead.respostas.find((r) => !CHAVES_FORA_DO_RESUMO.includes(r.chave))
  return r ? formatarValor(r.valor) : ''
}

// Quentes primeiro dentro de cada coluna; depois os mais recentes.
const ORDEM_TEMPERATURA: Record<string, number> = { quente: 0, morno: 1, frio: 2 }
const ordemTemperatura = (l: Lead) => ORDEM_TEMPERATURA[temperaturaDoLead(l) ?? ''] ?? 3

const colunas: { key: LeadStatus; cor: string }[] = [
  { key: 'novo',        cor: 'border-brand-rosa' },
  { key: 'em_contato',  cor: 'border-yellow-400/70' },
  { key: 'qualificado', cor: 'border-brand-lavanda/40' },
  { key: 'proposta',    cor: 'border-brand-lavanda/70' },
  { key: 'convertido',  cor: 'border-brand-lima' },
  { key: 'descartado',  cor: 'border-white/[0.12]' },
]
const FECHADAS: string[] = ['convertido', 'descartado']
// Fechados e perdidos antigos saem do quadro (continuam na lista e na conversão).
const DIAS_NO_QUADRO = 30
// Lead parado há mais tempo que isso numa etapa aberta ganha destaque.
const DIAS_PARADO = 7

const diasDesde = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000

// Selo do próximo contato no card e na lista.
function ProximoContato({ dia, hoje }: { dia: string | null; hoje: string }) {
  const s = situacaoContato(dia, hoje)
  if (!s || !dia) return null
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px]',
      s === 'atrasado' ? 'text-brand-rosa' : s === 'hoje' ? 'text-brand-lima' : 'text-brand-lavanda/50'
    )}>
      <CalendarClock className="h-3 w-3" />
      {s === 'hoje' ? 'Hoje' : s === 'atrasado' ? `Atrasado · ${formatDate(dia, 'dd/MM')}` : formatDate(dia, 'dd/MM')}
    </span>
  )
}

function ColunaDroppable({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn('p-2 space-y-2 min-h-[360px] rounded-b-xl transition-colors', isOver && 'bg-brand-violeta/[0.06]')}>
      {children}
    </div>
  )
}

function LeadCard({ lead, toques = 0, hoje, onAbrir, onWhatsapp, fantasma = false }: { lead: Lead; toques?: number; hoje: string; onAbrir?: () => void; onWhatsapp?: () => void; fantasma?: boolean }) {
  const aberto = !FECHADAS.includes(lead.status)
  const parado = aberto && diasDesde(lead.etapa_desde) > DIAS_PARADO
  const passo = aberto && proximoPasso(lead.status)
  const zap = whatsappUrl(lead.telefone, lead.status === 'novo' ? mensagemWhatsapp.primeiroContato(lead.nome, labelFrenteLead(lead.frente)) : undefined)
  return (
    <Card className={cn('cursor-pointer hover:border-white/[0.15] transition-colors', fantasma && 'rotate-2 shadow-2xl')} onClick={onAbrir}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          {lead.status === 'novo' && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-rosa" aria-label="Novo" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-brand-lavanda leading-snug truncate">{lead.nome}</p>
            {lead.empresa && <p className="text-xs text-brand-lavanda/40 truncate">{lead.empresa}</p>}
          </div>
          {zap && aberto && !fantasma && (
            // Atalho direto pro WhatsApp sem abrir o lead (e sem começar a arrastar o card).
            <a
              href={zap}
              target="_blank"
              rel="noreferrer"
              title="Chamar no WhatsApp"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onWhatsapp?.() }}
              className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-brand-lavanda/40 hover:bg-white/[0.06] hover:text-brand-lima"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <TemperaturaBadge temperatura={temperaturaDoLead(lead)} />
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: corFrenteLead(lead.frente) }} title={labelFrenteLead(lead.frente)} />
          <p className="text-[11px] text-brand-lavanda/50 truncate">{labelFrenteLead(lead.frente)} · {canalDoLead(lead)}</p>
        </div>
        {lead.status === 'descartado' && lead.motivo_perda && (
          <p className="text-[11px] text-brand-rosa/70 truncate">{lead.motivo_perda}</p>
        )}
        {(aberto && lead.proximo_contato || toques > 0) && (
          <div className="flex items-center gap-2.5">
            {aberto && <ProximoContato dia={lead.proximo_contato} hoje={hoje} />}
            {toques > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-brand-lavanda/40">
                <PhoneCall className="h-3 w-3" /> {toques}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className={cn('flex items-center gap-1 text-[11px]', parado ? 'text-yellow-400' : 'text-brand-lavanda/40')}>
            <Clock className="h-3 w-3" /> {formatRelative(lead.etapa_desde)}
          </span>
          {lead.valor_estimado != null && (
            <span className="text-[11px] font-medium text-brand-lima">{formatCurrency(lead.valor_estimado)}</span>
          )}
        </div>
        {passo && (
          <p className="flex items-center gap-1 border-t border-white/[0.04] pt-1.5 text-[11px] text-brand-violeta">
            <ArrowRight className="h-3 w-3 shrink-0" /> <span className="truncate">{passo}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function LeadArrastavel({ lead, toques, hoje, onAbrir, onWhatsapp }: { lead: Lead; toques: number; hoje: string; onAbrir: () => void; onWhatsapp: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn('touch-none', isDragging && 'opacity-30')}
      {...attributes}
      {...listeners}
    >
      <LeadCard lead={lead} toques={toques} hoje={hoje} onAbrir={onAbrir} onWhatsapp={onWhatsapp} />
    </div>
  )
}

function LeadsConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [visao, setVisao] = useState<'funil' | 'lista'>('funil')
  const [filtroStatus, setFiltroStatus] = useState<string>('ativos')
  const [filtroTemperatura, setFiltroTemperatura] = useState<Temperatura | 'todas'>('todas')
  const [soTrafegoPago, setSoTrafegoPago] = useState(false)
  const [filtroFrente, setFiltroFrente] = useState<FrenteLead | 'todas'>('todas')
  const [soParaHoje, setSoParaHoje] = useState(false)
  const [periodo, setPeriodo] = useState<PeriodoChave>('tudo')
  const [periodoCustom, setPeriodoCustom] = useState<{ de: string | null; ate: string | null }>({ de: null, ate: null })
  // Histórico de etapas (até onde cada lead chegou) e quando foi o primeiro contato de cada um.
  const [historico, setHistorico] = useState<Map<string, Historico[]>>(new Map())
  const [primeiroContato, setPrimeiroContato] = useState<Map<string, string>>(new Map())
  // Quantos contatos (toques) cada lead já recebeu.
  const [toques, setToques] = useState<Map<string, number>>(new Map())
  const hoje = diaSP(new Date())
  const [abertoId, setAbertoId] = useState<string | null>(searchParams.get('lead'))
  const [novoAberto, setNovoAberto] = useState(false)
  const [arrastando, setArrastando] = useState<Lead | null>(null)
  // Lead solto na coluna "Perdido": espera o motivo antes de salvar.
  const [perdendo, setPerdendo] = useState<Lead | null>(null)
  const [motivo, setMotivo] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    try {
      const salva = localStorage.getItem('leads:visao')
      if (salva === 'funil' || salva === 'lista') setVisao(salva)
      const p = localStorage.getItem('leads:periodo') as PeriodoChave | null
      if (p && p !== 'personalizado' && periodoOpcoes.some((o) => o.value === p)) setPeriodo(p)
    } catch {}
    async function load() {
      const supabase = createClient() as any
      const [{ data, error }, { data: contatos }, { data: hist }] = await Promise.all([
        supabase.from('leads').select(LEAD_SELECT).order('created_at', { ascending: false }),
        supabase.from('lead_contatos').select('lead_id, created_at'),
        supabase.from('lead_historico').select('lead_id, de, para, created_at'),
      ])
      if (error) setErro('Não foi possível carregar os leads. As migrations do funil já foram aplicadas no Supabase?')
      setLeads((data as Lead[]) ?? [])
      const contagem = new Map<string, number>()
      const primeiro = new Map<string, string>()
      for (const c of (contatos ?? []) as { lead_id: string; created_at: string }[]) {
        contagem.set(c.lead_id, (contagem.get(c.lead_id) ?? 0) + 1)
        const atual = primeiro.get(c.lead_id)
        if (!atual || c.created_at < atual) primeiro.set(c.lead_id, c.created_at)
      }
      setToques(contagem)
      setPrimeiroContato(primeiro)
      const porLead = new Map<string, Historico[]>()
      for (const h of (hist ?? []) as Historico[]) porLead.set(h.lead_id, [...(porLead.get(h.lead_id) ?? []), h])
      setHistorico(porLead)
      setLoading(false)
    }
    load()
  }, [])

  function trocarVisao(v: 'funil' | 'lista') {
    setVisao(v)
    try { localStorage.setItem('leads:visao', v) } catch {}
  }

  function trocarPeriodo(p: PeriodoChave) {
    setPeriodo(p)
    if (p === 'personalizado' && !periodoCustom.de) setPeriodoCustom({ de: somarDias(hoje, -29), ate: hoje })
    try { localStorage.setItem('leads:periodo', p) } catch {}
  }

  function abrir(id: string | null) {
    setAbertoId(id)
    router.replace(id ? `/leads?lead=${id}` : '/leads', { scroll: false })
  }

  async function mover(lead: Lead, status: string, motivoPerda: string | null = null) {
    const antes = lead
    const campos = { status, motivo_perda: status === 'descartado' ? motivoPerda : null }
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...campos, etapa_desde: new Date().toISOString() } : l)))
    const { error } = await (createClient() as any)
      .from('leads')
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq('id', lead.id)
    if (error) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? antes : l)))
      setErro('Não foi possível mover o lead.')
    }
  }

  function handleDragStart(e: DragStartEvent) {
    setArrastando(leads.find((l) => l.id === e.active.id) ?? null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setArrastando(null)
    const destino = e.over?.id as string | undefined
    const lead = leads.find((l) => l.id === e.active.id)
    if (!destino || !lead || lead.status === destino || !colunas.some((c) => c.key === destino)) return
    if (destino === 'descartado') {
      setMotivo('')
      setPerdendo(lead)
      return
    }
    mover(lead, destino)
  }

  const termo = busca.toLowerCase()
  // Período (pela data de chegada) e negócio valem para tudo na tela: cards, quadro, lista e contadores.
  const intervalo = intervaloDoPeriodo(periodo, hoje, periodoCustom)
  const anterior = intervaloAnterior(intervalo)
  const filtraPeriodo = periodo !== 'tudo'
  const doNegocio = (l: Lead) => filtroFrente === 'todas' || l.frente === filtroFrente
  const noPeriodo = leads.filter((l) => noIntervalo(diaSP(l.created_at), intervalo))
  const daFrente = noPeriodo.filter(doNegocio)
  const doPeriodoAnterior = anterior ? leads.filter((l) => doNegocio(l) && noIntervalo(diaSP(l.created_at), anterior)) : []
  const buscados = daFrente.filter((l) =>
    (!termo || [l.nome, l.email, l.telefone, l.empresa].some((v) => v?.toLowerCase().includes(termo))) &&
    (filtroTemperatura === 'todas' || temperaturaDoLead(l) === filtroTemperatura) &&
    (!soTrafegoPago || ehTrafegoPago(l)) &&
    (!soParaHoje || (!FECHADAS.includes(l.status) && contatoPendente(l.proximo_contato, hoje)))
  )
  const paraHoje = daFrente.filter((l) => !FECHADAS.includes(l.status) && contatoPendente(l.proximo_contato, hoje)).length
  const filtrados = buscados.filter((l) =>
    filtroStatus === 'todos' ||
    (filtroStatus === 'ativos' ? !FECHADAS.includes(l.status) : l.status === filtroStatus)
  )

  const abertos = daFrente.filter((l) => !FECHADAS.includes(l.status))
  const valorPipeline = abertos.reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0)
  const fechados = daFrente.filter((l) => l.status === 'convertido').length
  const aberto = leads.find((l) => l.id === abertoId) ?? null

  const filtros = [
    { key: 'ativos', label: 'Em aberto', count: abertos.length },
    ...Object.entries(leadStatusConfig).map(([key, sc]) => ({ key, label: sc.label, count: daFrente.filter((l) => l.status === key).length })),
    { key: 'todos', label: 'Todos', count: daFrente.length },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Leads" description="Funil de vendas" />

      <main className="flex-1 p-4 md:p-6">
        <LeadsSubNav />
        <PageHeader
          title="Funil de vendas"
          description={loading ? 'Carregando…' : `${abertos.length} em aberto • ${formatCurrency(valorPipeline)} no funil • ${taxa(fechados, daFrente.length)}% fechados`}
        >
          <div className="flex rounded-lg border border-white/[0.1] p-0.5">
            <button
              onClick={() => trocarVisao('funil')}
              className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs', visao === 'funil' ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50')}
            ><Columns3 className="h-3.5 w-3.5" /> Quadro</button>
            <button
              onClick={() => trocarVisao('lista')}
              className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs', visao === 'lista' ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50')}
            ><List className="h-3.5 w-3.5" /> Lista</button>
          </div>
          <Button onClick={() => setNovoAberto(true)}><Plus className="h-4 w-4" /> Novo lead</Button>
        </PageHeader>

        {erro && <p className="mb-4 text-sm text-brand-rosa">{erro}</p>}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-lg border border-white/[0.1] p-0.5">
            {periodoOpcoes.map((o) => (
              <button
                key={o.value}
                onClick={() => trocarPeriodo(o.value)}
                className={cn('rounded-md px-2.5 py-1.5 text-xs', periodo === o.value ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50 hover:text-brand-lavanda/80')}
              >{o.label}</button>
            ))}
          </div>
          {periodo === 'personalizado' && (
            <div className="flex items-center gap-2 text-xs text-brand-lavanda/50">
              <Input type="date" className="h-8 w-[150px]" value={periodoCustom.de ?? ''} onChange={(e) => setPeriodoCustom((c) => ({ ...c, de: e.target.value || null }))} />
              até
              <Input type="date" className="h-8 w-[150px]" value={periodoCustom.ate ?? ''} onChange={(e) => setPeriodoCustom((c) => ({ ...c, ate: e.target.value || null }))} />
            </div>
          )}
          {filtraPeriodo && intervalo.de && (
            <span className="text-[11px] text-brand-lavanda/40">
              Leads que chegaram {intervalo.de === intervalo.ate ? `em ${formatDate(intervalo.de, 'dd/MM')}` : `de ${formatDate(intervalo.de, 'dd/MM')} a ${formatDate(intervalo.ate ?? hoje, 'dd/MM')}`}
            </span>
          )}
        </div>

        {!loading && (
          <ResumoLeads
            leads={daFrente}
            anteriores={doPeriodoAnterior}
            historico={historico}
            primeiroContato={primeiroContato}
            toques={toques}
            comparar={!!anterior}
          />
        )}

        {visao === 'lista' && !loading && leads.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {filtros.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFiltroStatus(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                  filtroStatus === key
                    ? 'border-brand-lima bg-brand-lima/20 text-brand-lima'
                    : 'border-white/[0.1] bg-white/[0.04] text-brand-lavanda/70 hover:border-white/[0.2] hover:text-brand-lavanda'
                )}
              >
                {label}
                <span className="rounded-full bg-white/[0.02] px-1.5">{count}</span>
              </button>
            ))}
          </div>
        )}

        {!loading && leads.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {([{ value: 'todas', label: 'Todos os negócios' }, ...frenteLeadOpcoes] as const).map((o) => {
              const qtd = o.value === 'todas' ? noPeriodo.length : noPeriodo.filter((l) => l.frente === o.value).length
              if (o.value !== 'todas' && qtd === 0 && filtroFrente !== o.value) return null
              return (
                <button
                  key={o.value}
                  onClick={() => setFiltroFrente(o.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    filtroFrente === o.value
                      ? 'border-brand-lima bg-brand-lima/20 text-brand-lima'
                      : 'border-white/[0.1] bg-white/[0.04] text-brand-lavanda/70 hover:border-white/[0.2] hover:text-brand-lavanda'
                  )}
                >
                  {o.value !== 'todas' && <span className="h-2 w-2 rounded-full" style={{ background: corFrenteLead(o.value) }} />}
                  {o.label}
                  <span className="rounded-full bg-white/[0.02] px-1.5">{qtd}</span>
                </button>
              )
            })}
          </div>
        )}

        {!loading && leads.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(['todas', ...TEMPERATURAS] as const).map((t) => {
              const qtd = t === 'todas' ? daFrente.length : daFrente.filter((l) => temperaturaDoLead(l) === t).length
              return (
                <button
                  key={t}
                  onClick={() => setFiltroTemperatura(t)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    filtroTemperatura === t
                      ? 'border-brand-lima bg-brand-lima/20 text-brand-lima'
                      : 'border-white/[0.1] bg-white/[0.04] text-brand-lavanda/70 hover:border-white/[0.2] hover:text-brand-lavanda'
                  )}
                >
                  {t === 'todas' ? 'Todas as temperaturas' : `${temperaturaConfig[t].emoji} ${temperaturaConfig[t].label}`}
                  <span className="rounded-full bg-white/[0.02] px-1.5">{qtd}</span>
                </button>
              )
            })}
            <button
              onClick={() => setSoTrafegoPago((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                soTrafegoPago
                  ? 'border-brand-lima bg-brand-lima/20 text-brand-lima'
                  : 'border-white/[0.1] bg-white/[0.04] text-brand-lavanda/70 hover:border-white/[0.2] hover:text-brand-lavanda'
              )}
            >
              Só tráfego pago
              <span className="rounded-full bg-white/[0.02] px-1.5">{daFrente.filter(ehTrafegoPago).length}</span>
            </button>
            <button
              onClick={() => setSoParaHoje((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                soParaHoje
                  ? 'border-brand-lima bg-brand-lima/20 text-brand-lima'
                  : paraHoje > 0
                    ? 'border-brand-rosa/40 bg-brand-rosa/10 text-brand-lavanda hover:border-brand-rosa/60'
                    : 'border-white/[0.1] bg-white/[0.04] text-brand-lavanda/70 hover:border-white/[0.2] hover:text-brand-lavanda'
              )}
            >
              <CalendarClock className="h-3 w-3" /> Falar hoje
              <span className="rounded-full bg-white/[0.02] px-1.5">{paraHoje}</span>
            </button>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
          <Input className="pl-9" placeholder="Buscar por nome, e-mail, telefone ou empresa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : visao === 'funil' ? (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {colunas.map((col) => {
                const naColuna = buscados
                  .filter((l) => l.status === col.key && (filtraPeriodo || !FECHADAS.includes(col.key) || diasDesde(l.etapa_desde) <= DIAS_NO_QUADRO))
                  // Contato vencido ou de hoje no topo; depois os mais quentes.
                  .sort((a, b) =>
                    Number(contatoPendente(b.proximo_contato, hoje)) - Number(contatoPendente(a.proximo_contato, hoje)) ||
                    ordemTemperatura(a) - ordemTemperatura(b))
                const soma = naColuna.reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0)
                return (
                  <div key={col.key} className={cn('w-64 shrink-0 rounded-xl border-t-2 bg-brand-noite/30', col.cor)}>
                    <div className="px-3 py-2.5 border-b border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-brand-lavanda">{leadStatusConfig[col.key].label}</h3>
                        <span className="text-xs text-brand-lavanda/50 bg-brand-noite/60 rounded-full px-2 py-0.5">{naColuna.length}</span>
                      </div>
                      <p className="text-[11px] text-brand-lavanda/40 mt-0.5">
                        {soma > 0 ? formatCurrency(soma) : '—'}
                        {FECHADAS.includes(col.key) && !filtraPeriodo && ` · últimos ${DIAS_NO_QUADRO} dias`}
                      </p>
                    </div>
                    <ColunaDroppable id={col.key}>
                      {naColuna.length === 0 && <p className="text-xs text-brand-lavanda/20 text-center py-6">Vazio</p>}
                      {naColuna.map((l) => <LeadArrastavel key={l.id} lead={l} toques={toques.get(l.id) ?? 0} hoje={hoje} onAbrir={() => abrir(l.id)} onWhatsapp={() => l.status === 'novo' && mover(l, 'em_contato')} />)}
                    </ColunaDroppable>
                  </div>
                )
              })}
            </div>
            <DragOverlay dropAnimation={null}>
              {arrastando ? <LeadCard lead={arrastando} toques={toques.get(arrastando.id) ?? 0} hoje={hoje} fantasma /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Lead</th>
                      <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Contato</th>
                      <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Origem</th>
                      <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Interesse</th>
                      <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Recebido</th>
                      <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Próximo contato</th>
                      <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <Inbox className="h-10 w-10 text-brand-lavanda/20 mx-auto mb-3" />
                          <p className="text-brand-lavanda/40 text-sm">
                            {leads.length === 0 ? 'Nenhum lead ainda. Os contatos do formulário do site aparecem aqui.' : 'Nenhum lead encontrado.'}
                          </p>
                        </td>
                      </tr>
                    ) : filtrados.map((l) => {
                      const sc = leadStatusConfig[l.status as LeadStatus]
                      return (
                        <tr key={l.id} onClick={() => abrir(l.id)} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              {l.status === 'novo' && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-rosa" aria-label="Novo" />}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className={cn('truncate max-w-[220px] group-hover:text-brand-lima transition-colors', l.status === 'novo' ? 'font-semibold text-brand-lavanda' : 'font-medium text-brand-lavanda/80')}>{l.nome}</p>
                                  <TemperaturaBadge temperatura={temperaturaDoLead(l)} pontos={pontuacaoDoLead(l)} />
                                </div>
                                {l.empresa && <p className="text-xs text-brand-lavanda/40 truncate max-w-[220px]">{l.empresa}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-brand-lavanda/60">
                            <p>{l.telefone ?? '—'}</p>
                            {l.email && <p className="text-brand-lavanda/40">{l.email}</p>}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-brand-lavanda/60 whitespace-nowrap">
                            <p className="flex items-center gap-1.5 text-brand-lavanda/80">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: corFrenteLead(l.frente) }} />
                              {labelFrenteLead(l.frente)}
                            </p>
                            <p className="text-brand-lavanda/40">{canalDoLead(l)}</p>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-brand-lavanda/60">
                            <p className="truncate max-w-[260px]">{resumo(l) || '—'}</p>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-brand-lavanda/50 whitespace-nowrap">{formatRelative(l.created_at)}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {!FECHADAS.includes(l.status) && l.proximo_contato ? <ProximoContato dia={l.proximo_contato} hoje={hoje} /> : <span className="text-xs text-brand-lavanda/30">—</span>}
                          </td>
                          <td className="px-4 py-3.5">{sc && <Badge variant={sc.variant}>{sc.label}</Badge>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <LeadDetalheDialog
        lead={aberto}
        onOpenChange={(open) => !open && abrir(null)}
        onChange={(lead) => setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)))}
        onContato={(c) => setToques((prev) => new Map(prev).set(c.lead_id, (prev.get(c.lead_id) ?? 0) + 1))}
        onDelete={(id) => {
          setLeads((prev) => prev.filter((l) => l.id !== id))
          abrir(null)
        }}
      />

      <NovoLeadDialog open={novoAberto} onOpenChange={setNovoAberto} onCriado={(lead) => setLeads((prev) => [lead, ...prev])} />

      <Dialog open={!!perdendo} onOpenChange={(open) => !open && setPerdendo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Por que perdemos?</DialogTitle>
            <DialogDescription>{perdendo?.nome} — o motivo aparece no relatório de conversão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 pt-2">
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Escolha um motivo" /></SelectTrigger>
              <SelectContent>
                {motivoPerdaOpcoes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setPerdendo(null)}>Cancelar</Button>
            <Button
              disabled={!motivo}
              onClick={() => {
                if (perdendo) mover(perdendo, 'descartado', motivo)
                setPerdendo(null)
              }}
            >
              Marcar como perdido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsConteudo />
    </Suspense>
  )
}

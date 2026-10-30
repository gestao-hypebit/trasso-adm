'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Plus, Video, Phone, Package, Clock, Pencil, Loader2, CalendarDays, Trash2, ExternalLink,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, isToday, addMonths, subMonths, getDay, addDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useAviso } from '@/components/ui/toaster'

type Evento = {
  id: string
  titulo: string
  tipo: string | null
  data_inicio: string
  data_fim: string | null
  dia_inteiro?: boolean
  link_meet: string | null
  google_event_id?: string | null
  link_google?: string | null
  clientes: { nome: string } | null
}

const tipoConfig = {
  reuniao:  { label: 'Reunião',   cor: 'bg-brand-violeta',  text: 'text-brand-lavanda', icon: Video },
  entrega:  { label: 'Entrega',   cor: 'bg-brand-lima',     text: 'text-brand-noite',   icon: Package },
  deadline: { label: 'Deadline',  cor: 'bg-brand-rosa',     text: 'text-white',          icon: Clock },
  ligacao:  { label: 'Ligação',   cor: 'bg-blue-500',       text: 'text-white',          icon: Phone },
  outro:    { label: 'Outro',     cor: 'bg-brand-violeta/50', text: 'text-brand-lavanda', icon: Pencil },
  gcal:     { label: 'Google Agenda', cor: 'bg-sky-500/80', text: 'text-white',          icon: CalendarDays },
}
// O que dá para escolher ao criar (eventos do Google só chegam de lá).
const tiposCriaveis = Object.entries(tipoConfig).filter(([k]) => k !== 'gcal')

const configDoTipo = (tipo: string | null) => tipoConfig[(tipo ?? 'outro') as keyof typeof tipoConfig] ?? tipoConfig.outro

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const SELECT_EVENTO = 'id, titulo, tipo, data_inicio, data_fim, link_meet, google_event_id, clientes(nome)'

const EVENTO_VAZIO = {
  titulo: '', tipo: 'reuniao', cliente_id: '', data_inicio: '', data_fim: '', link_meet: '', descricao: '',
  noGoogle: true, gerarMeet: false,
}

const horario = (e: Evento) => e.dia_inteiro
  ? 'Dia inteiro'
  : `${format(new Date(e.data_inicio), 'HH:mm')}${e.data_fim ? ` → ${format(new Date(e.data_fim), 'HH:mm')}` : ''}`

function Carregando({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-center justify-center gap-2 text-xs text-brand-lavanda/40', className)}>
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando agenda…
    </p>
  )
}

function AgendaConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const avisar = useAviso()
  const [eventos, setEventos] = useState<Evento[]>([])
  const [doGoogle, setDoGoogle] = useState<Evento[]>([])
  const [google, setGoogle] = useState<{ connected: boolean; email: string | null } | null>(null)
  const [avisoGoogle, setAvisoGoogle] = useState<string | null>(null)
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(new Date())
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([])
  const [novoOpen, setNovoOpen] = useState(false)
  const [form, setForm] = useState(EVENTO_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [apagando, setApagando] = useState<string | null>(null)
  const [carregandoSlick, setCarregandoSlick] = useState(true)
  const [carregandoGoogle, setCarregandoGoogle] = useState(true)

  useEffect(() => {
    const supabase = createClient() as any
    async function load() {
      const [{ data }, { data: cls }] = await Promise.all([
        supabase.from('eventos').select(SELECT_EVENTO).order('data_inicio', { ascending: true }),
        supabase.from('clientes').select('id, nome').order('nome'),
      ])
      setEventos((data as Evento[]) ?? [])
      setClientes(cls ?? [])
      setCarregandoSlick(false)
    }
    load()
    fetch('/api/google-calendar/status')
      .then((r) => r.json())
      .then((s) => {
        setGoogle({ connected: !!s.connected, email: s.email ?? null })
        if (!s.connected) setCarregandoGoogle(false)
      })
      .catch(() => {
        setGoogle({ connected: false, email: null })
        setCarregandoGoogle(false)
      })
  }, [])

  // Busca (Ctrl+K): /agenda?novo=1 abre o cadastro de evento.
  const novoParam = searchParams.get('novo')
  useEffect(() => {
    if (!novoParam) return
    abrirNovo(true)
    router.replace('/agenda', { scroll: false })
  }, [novoParam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Eventos do Google do mês na tela (com folga de uma semana para cada lado).
  useEffect(() => {
    if (!google?.connected) return
    const timeMin = addDays(startOfMonth(mesAtual), -7).toISOString()
    const timeMax = addDays(endOfMonth(mesAtual), 7).toISOString()
    setCarregandoGoogle(true)
    fetch(`/api/google-calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
      .then((r) => r.json())
      .then((d) => {
        setDoGoogle(d.events ?? [])
        setAvisoGoogle(d.error ?? null)
      })
      .catch(() => setAvisoGoogle('Não foi possível ler o Google Agenda.'))
      .finally(() => setCarregandoGoogle(false))
  }, [google?.connected, mesAtual])

  function abrirNovo(open: boolean) {
    if (open) {
      const base = diaSelecionado ?? new Date()
      setForm({ ...EVENTO_VAZIO, data_inicio: `${format(base, 'yyyy-MM-dd')}T10:00` })
      setErro(null)
    }
    setNovoOpen(open)
  }

  async function criarEvento() {
    if (!form.titulo.trim() || !form.data_inicio) { setErro('Preencha título e início.'); return }
    setSalvando(true)
    setErro(null)
    const { data, error } = await (createClient() as any)
      .from('eventos')
      .insert({
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        cliente_id: form.cliente_id && form.cliente_id !== 'none' ? form.cliente_id : null,
        data_inicio: new Date(form.data_inicio).toISOString(),
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
        link_meet: form.link_meet.trim() || null,
        descricao: form.descricao.trim() || null,
      })
      .select(SELECT_EVENTO)
      .single()
    if (error) { setSalvando(false); setErro(error.message); return }

    let evento = data as Evento
    if (google?.connected && form.noGoogle) {
      const res = await fetch('/api/google-calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento_id: evento.id, gerar_meet: form.gerarMeet && !form.link_meet.trim() }),
      })
      const r = await res.json().catch(() => ({}))
      if (res.ok) {
        evento = { ...evento, google_event_id: r.gcal_id, link_meet: r.link_meet ?? evento.link_meet }
        setDoGoogle((prev) => prev.filter((g) => g.id !== `gcal_${r.gcal_id}`))
      } else {
        setAvisoGoogle(r.error ?? 'O evento foi salvo na Slick, mas não no Google Agenda.')
      }
    }

    setSalvando(false)
    setEventos(prev => [...prev, evento].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)))
    setNovoOpen(false)
    setDiaSelecionado(new Date(evento.data_inicio))
    setMesAtual(new Date(evento.data_inicio))
    avisar(`Evento criado${evento.google_event_id ? ' e enviado ao Google Agenda' : ''}`)
  }

  async function apagar(e: Evento) {
    if (apagando !== e.id) { setApagando(e.id); return }
    setApagando(null)
    const gcalId = e.tipo === 'gcal' ? e.id.replace(/^gcal_/, '') : e.google_event_id
    if (gcalId) {
      const res = await fetch(`/api/google-calendar/events?id=${encodeURIComponent(gcalId)}`, { method: 'DELETE' })
      if (!res.ok) {
        const r = await res.json().catch(() => ({}))
        setAvisoGoogle(r.error ?? 'Não foi possível apagar no Google Agenda.')
        if (e.tipo === 'gcal') return
      }
    }
    if (e.tipo === 'gcal') {
      setDoGoogle((prev) => prev.filter((g) => g.id !== e.id))
      return
    }
    const { error } = await (createClient() as any).from('eventos').delete().eq('id', e.id)
    if (error) { avisar('Não foi possível apagar o evento.', { tipo: 'erro' }); return }
    setEventos((prev) => prev.filter((x) => x.id !== e.id))
    avisar(`"${e.titulo}" apagado`)
  }

  // Evento da Slick que já foi para o Google não aparece duas vezes.
  const idsNoGoogle = new Set(eventos.map((e) => e.google_event_id).filter(Boolean))
  const todos = [...eventos, ...doGoogle.filter((g) => !idsNoGoogle.has(g.id.replace(/^gcal_/, '')))]
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))

  const diasDoMes = eachDayOfInterval({ start: startOfMonth(mesAtual), end: endOfMonth(mesAtual) })
  const primeiroDiaSemana = getDay(startOfMonth(mesAtual))
  const diasVazios = Array.from({ length: primeiroDiaSemana })

  function eventosNoDia(dia: Date) {
    return todos.filter(e => isSameDay(new Date(e.data_inicio), dia))
  }

  const eventosDiaSelecionado = diaSelecionado ? eventosNoDia(diaSelecionado) : []
  // Enquanto a agenda da Slick ou a do Google não chegou, não dá para dizer "nenhum evento".
  const carregando = carregandoSlick || carregandoGoogle

  const agora = new Date()
  const proximosEventos = todos
    .filter(e => new Date(e.data_fim ?? e.data_inicio) >= agora || (e.dia_inteiro && isToday(new Date(e.data_inicio))))
    .slice(0, 6)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Agenda" description="Calendário de eventos e entregas" />

      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="Agenda">
          <Dialog open={novoOpen} onOpenChange={abrirNovo}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Título *</Label>
                  <Input placeholder="Ex: Reunião de alinhamento" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Tipo</Label>
                    <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {tiposCriaveis.map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Cliente</Label>
                    <Select value={form.cliente_id} onValueChange={v => setForm({ ...form, cliente_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Início *</Label>
                    <Input type="datetime-local" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Fim</Label>
                    <Input type="datetime-local" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Link da reunião</Label>
                  <Input placeholder="https://meet.google.com/..." value={form.link_meet} onChange={e => setForm({ ...form, link_meet: e.target.value })} />
                </div>
                <div>
                  <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Descrição</Label>
                  <Textarea placeholder="Detalhes do evento..." rows={2} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
                </div>
                {google?.connected && (
                  <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <label className="flex items-center gap-2 text-sm text-brand-lavanda/80 cursor-pointer">
                      <input type="checkbox" className="accent-brand-lima" checked={form.noGoogle} onChange={e => setForm({ ...form, noGoogle: e.target.checked })} />
                      Salvar também no Google Agenda
                    </label>
                    {form.noGoogle && !form.link_meet.trim() && (
                      <label className="flex items-center gap-2 text-sm text-brand-lavanda/80 cursor-pointer">
                        <input type="checkbox" className="accent-brand-lima" checked={form.gerarMeet} onChange={e => setForm({ ...form, gerarMeet: e.target.checked })} />
                        Gerar link do Google Meet
                      </label>
                    )}
                  </div>
                )}
                {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNovoOpen(false)} disabled={salvando}>Cancelar</Button>
                <Button onClick={criarEvento} disabled={salvando}>
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Evento'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PageHeader>

        {google && !google.connected && (
          <p className="mb-4 text-xs text-brand-lavanda/60 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <CalendarDays className="inline h-3.5 w-3.5 mr-1.5 text-sky-400" />
            Conecte o Google Agenda em{' '}
            <Link href="/configuracoes?tab=integracoes" className="text-brand-lima">Configurações → Integrações</Link>{' '}
            para ver seus compromissos aqui e mandar os eventos da Slick para lá.
          </p>
        )}
        {avisoGoogle && <p className="mb-4 text-xs text-brand-rosa">{avisoGoogle}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <Button variant="ghost" size="icon" onClick={() => setMesAtual(m => subMonths(m, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-brand-lavanda capitalize" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
                    {carregando && <Loader2 className="h-4 w-4 animate-spin text-brand-lavanda/40" aria-label="Carregando" />}
                  </h2>
                  <Button variant="ghost" size="icon" onClick={() => setMesAtual(m => addMonths(m, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 mb-2">
                  {DIAS_SEMANA.map((d) => (
                    <div key={d} className="text-center text-xs text-brand-lavanda/40 font-medium py-1">{d}</div>
                  ))}
                </div>

                <div className={cn('grid grid-cols-7 gap-1 transition-opacity', carregandoSlick && 'opacity-40 animate-pulse pointer-events-none')}>
                  {diasVazios.map((_, i) => <div key={`v${i}`} />)}
                  {diasDoMes.map((dia) => {
                    const evs = eventosNoDia(dia)
                    const isSelected = diaSelecionado && isSameDay(dia, diaSelecionado)
                    const isHoje = isToday(dia)
                    return (
                      <button
                        key={dia.toISOString()}
                        onClick={() => setDiaSelecionado(isSameDay(dia, diaSelecionado!) ? null : dia)}
                        className={cn(
                          'relative min-w-0 flex flex-col items-center md:items-stretch rounded-xl p-1.5 min-h-[56px] md:min-h-[104px] text-sm text-left transition-all',
                          'md:border md:border-white/[0.04]',
                          isSelected ? 'bg-white/[0.1] ring-2 ring-brand-violeta' : 'hover:bg-brand-violeta/10',
                          isHoje && !isSelected && 'ring-1 ring-brand-lima/50',
                          !isSameMonth(dia, mesAtual) && 'opacity-30'
                        )}
                      >
                        <span className={cn(
                          'text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center shrink-0',
                          isHoje ? 'bg-brand-lima text-brand-noite font-bold' : 'text-brand-lavanda/70'
                        )}>
                          {format(dia, 'd')}
                        </span>

                        {/* Celular: célula estreita, só as bolinhas. */}
                        <div className="flex flex-wrap gap-0.5 justify-center mt-1 md:hidden">
                          {evs.slice(0, 3).map((e, i) => (
                            <span key={i} className={cn('h-1.5 w-1.5 rounded-full', configDoTipo(e.tipo).cor)} />
                          ))}
                          {evs.length > 3 && <span className="text-[9px] text-brand-lavanda/40">+{evs.length - 3}</span>}
                        </div>

                        {/* Telas maiores: etiqueta com horário e título, como no Google Agenda. */}
                        <div className="hidden md:flex flex-col gap-0.5 mt-1 min-w-0">
                          {evs.slice(0, 3).map((e) => {
                            const tc = configDoTipo(e.tipo)
                            return (
                              <span
                                key={e.id}
                                title={`${horario(e)} · ${e.titulo}`}
                                className={cn('block truncate rounded px-1.5 py-0.5 text-[11px] leading-tight', tc.cor, tc.text)}
                              >
                                {!e.dia_inteiro && <span className="font-semibold mr-1">{format(new Date(e.data_inicio), 'HH:mm')}</span>}
                                {e.titulo}
                              </span>
                            )
                          })}
                          {evs.length > 3 && (
                            <span className="px-1.5 text-[11px] text-brand-lavanda/50">+{evs.length - 3} mais</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {diaSelecionado && (
                  <div className="mt-6 border-t border-white/[0.06] pt-4">
                    <h3 className="text-sm font-semibold text-brand-lavanda mb-3">
                      {format(diaSelecionado, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </h3>
                    {eventosDiaSelecionado.length === 0 && carregando ? (
                      <Carregando className="justify-start" />
                    ) : eventosDiaSelecionado.length === 0 ? (
                      <p className="text-xs text-brand-lavanda/40">Nenhum evento neste dia.</p>
                    ) : (
                      <div className="space-y-2">
                        {eventosDiaSelecionado.map((e) => {
                          const tc = configDoTipo(e.tipo)
                          const TipoIcon = tc.icon
                          return (
                            <div key={e.id} className="flex items-center gap-3 rounded-xl p-3 bg-white/[0.02] border border-white/[0.06]">
                              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', tc.cor)}>
                                <TipoIcon className={cn('h-4 w-4', tc.text)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-brand-lavanda font-medium truncate">{e.titulo}</p>
                                <p className="text-xs text-brand-lavanda/40">
                                  {horario(e)}
                                  {e.clientes?.nome && ` • ${e.clientes.nome}`}
                                  {e.google_event_id && ' • no Google'}
                                </p>
                              </div>
                              {e.link_meet && (
                                <a href={e.link_meet} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm" className="text-xs h-7">
                                    <Video className="h-3 w-3 mr-1" />
                                    Meet
                                  </Button>
                                </a>
                              )}
                              {e.link_google && (
                                <a href={e.link_google} target="_blank" rel="noopener noreferrer" title="Abrir no Google Agenda">
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
                                </a>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => apagar(e)}
                                className={cn('h-7 text-xs', apagando === e.id ? 'text-brand-rosa' : 'text-brand-lavanda/40 hover:text-brand-rosa')}
                                title={e.google_event_id || e.tipo === 'gcal' ? 'Apaga aqui e no Google Agenda' : 'Apagar'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />{apagando === e.id && ' Confirmar'}
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-brand-lavanda">Próximos Eventos</h3>
              </div>
              <CardContent className="p-0">
                {proximosEventos.length === 0 && carregando ? (
                  <Carregando className="p-6" />
                ) : proximosEventos.length === 0 ? (
                  <p className="text-xs text-brand-lavanda/40 p-6 text-center">Nenhum evento próximo.</p>
                ) : proximosEventos.map((e) => {
                  const tc = configDoTipo(e.tipo)
                  const TipoIcon = tc.icon
                  return (
                    <div key={e.id} className="flex items-start gap-3 px-6 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors last:border-0">
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5', tc.cor)}>
                        <TipoIcon className={cn('h-4 w-4', tc.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-brand-lavanda font-medium truncate">{e.titulo}</p>
                        <p className="text-xs text-brand-lavanda/50">
                          {e.dia_inteiro
                            ? format(new Date(e.data_inicio), "d MMM '· dia inteiro'", { locale: ptBR })
                            : format(new Date(e.data_inicio), "d MMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {e.clientes?.nome && <p className="text-xs text-brand-lavanda/30">{e.clientes.nome}</p>}
                      </div>
                      {e.link_meet && (
                        <a href={e.link_meet} target="_blank" rel="noopener noreferrer" title="Entrar no Meet" className="mt-1 text-brand-lavanda/40 hover:text-brand-lima">
                          <Video className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-brand-lavanda">Legenda</h3>
              </div>
              <CardContent className="p-4 space-y-2">
                {Object.entries(tipoConfig).filter(([k]) => k !== 'gcal' || google?.connected).map(([key, tc]) => (
                  <div key={key} className="flex items-center gap-2.5 text-xs text-brand-lavanda/70">
                    <div className={cn('h-3 w-3 rounded-full shrink-0', tc.cor)} />
                    {tc.label}
                  </div>
                ))}
                {google?.connected && google.email && (
                  <p className="pt-2 text-[11px] text-brand-lavanda/40">Google Agenda: {google.email}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function AgendaPage() {
  return (
    <Suspense>
      <AgendaConteudo />
    </Suspense>
  )
}

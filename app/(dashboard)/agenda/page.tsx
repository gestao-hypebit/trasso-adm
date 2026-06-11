'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, Video, Phone, Package, Clock, Pencil } from 'lucide-react'
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
  isSameDay, isToday, addMonths, subMonths, getDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

type Evento = {
  id: string
  titulo: string
  tipo: string | null
  data_inicio: string
  data_fim: string | null
  link_meet: string | null
  clientes: { nome: string } | null
}

const tipoConfig = {
  reuniao:  { label: 'Reunião',   cor: 'bg-brand-violeta',  text: 'text-brand-lavanda', icon: Video },
  entrega:  { label: 'Entrega',   cor: 'bg-brand-lima',     text: 'text-brand-noite',   icon: Package },
  deadline: { label: 'Deadline',  cor: 'bg-brand-rosa',     text: 'text-white',          icon: Clock },
  ligacao:  { label: 'Ligação',   cor: 'bg-blue-500',       text: 'text-white',          icon: Phone },
  outro:    { label: 'Outro',     cor: 'bg-brand-violeta/50', text: 'text-brand-lavanda', icon: Pencil },
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function AgendaPage() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data } = await supabase
        .from('eventos')
        .select('id, titulo, tipo, data_inicio, data_fim, link_meet, clientes(nome)')
        .order('data_inicio', { ascending: true })
      setEventos((data as Evento[]) ?? [])
    }
    load()
  }, [])

  const diasDoMes = eachDayOfInterval({ start: startOfMonth(mesAtual), end: endOfMonth(mesAtual) })
  const primeiroDiaSemana = getDay(startOfMonth(mesAtual))
  const diasVazios = Array.from({ length: primeiroDiaSemana })

  function eventosNoDia(dia: Date) {
    return eventos.filter(e => isSameDay(new Date(e.data_inicio), dia))
  }

  const eventosDiaSelecionado = diaSelecionado ? eventosNoDia(diaSelecionado) : []

  const proximosEventos = eventos
    .filter(e => new Date(e.data_inicio) >= new Date())
    .slice(0, 5)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Agenda" description="Calendário de eventos e entregas" />

      <main className="flex-1 p-6">
        <PageHeader title="Agenda">
          <Dialog>
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
                  <Input placeholder="Ex: Reunião de alinhamento" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Tipo</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(tipoConfig).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Cliente</Label>
                    <Input placeholder="Nome do cliente" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Início *</Label>
                    <Input type="datetime-local" />
                  </div>
                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Fim</Label>
                    <Input type="datetime-local" />
                  </div>
                </div>
                <div>
                  <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Link da reunião</Label>
                  <Input placeholder="https://meet.google.com/..." />
                </div>
                <div>
                  <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Descrição</Label>
                  <Textarea placeholder="Detalhes do evento..." rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancelar</Button>
                <Button>Criar Evento</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PageHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <Button variant="ghost" size="icon" onClick={() => setMesAtual(m => subMonths(m, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-bold text-brand-lavanda capitalize" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
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

                <div className="grid grid-cols-7 gap-1">
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
                          'relative flex flex-col items-center rounded-xl p-1.5 min-h-[56px] text-sm transition-all',
                          isSelected ? 'bg-white/[0.1] ring-2 ring-brand-violeta' : 'hover:bg-brand-violeta/10',
                          isHoje && !isSelected && 'ring-1 ring-brand-lima/50',
                          !isSameMonth(dia, mesAtual) && 'opacity-30'
                        )}
                      >
                        <span className={cn(
                          'text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center',
                          isHoje ? 'bg-brand-lima text-brand-noite font-bold' : 'text-brand-lavanda/70'
                        )}>
                          {format(dia, 'd')}
                        </span>
                        <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                          {evs.slice(0, 3).map((e, i) => {
                            const tc = tipoConfig[(e.tipo ?? 'outro') as keyof typeof tipoConfig] ?? tipoConfig.outro
                            return <span key={i} className={cn('h-1.5 w-1.5 rounded-full', tc.cor)} />
                          })}
                          {evs.length > 3 && <span className="text-[9px] text-brand-lavanda/40">+{evs.length - 3}</span>}
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
                    {eventosDiaSelecionado.length === 0 ? (
                      <p className="text-xs text-brand-lavanda/40">Nenhum evento neste dia.</p>
                    ) : (
                      <div className="space-y-2">
                        {eventosDiaSelecionado.map((e) => {
                          const tc = tipoConfig[(e.tipo ?? 'outro') as keyof typeof tipoConfig] ?? tipoConfig.outro
                          const TipoIcon = tc.icon
                          return (
                            <div key={e.id} className="flex items-center gap-3 rounded-xl p-3 bg-white/[0.02] border border-white/[0.06]">
                              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', tc.cor)}>
                                <TipoIcon className={cn('h-4 w-4', tc.text)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-brand-lavanda font-medium truncate">{e.titulo}</p>
                                <p className="text-xs text-brand-lavanda/40">
                                  {format(new Date(e.data_inicio), 'HH:mm')}
                                  {e.data_fim && ` → ${format(new Date(e.data_fim), 'HH:mm')}`}
                                  {e.clientes?.nome && ` • ${e.clientes.nome}`}
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
                {proximosEventos.length === 0 ? (
                  <p className="text-xs text-brand-lavanda/40 p-6 text-center">Nenhum evento próximo.</p>
                ) : proximosEventos.map((e) => {
                  const tc = tipoConfig[(e.tipo ?? 'outro') as keyof typeof tipoConfig] ?? tipoConfig.outro
                  const TipoIcon = tc.icon
                  return (
                    <div key={e.id} className="flex items-start gap-3 px-6 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors last:border-0">
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5', tc.cor)}>
                        <TipoIcon className={cn('h-4 w-4', tc.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-brand-lavanda font-medium truncate">{e.titulo}</p>
                        <p className="text-xs text-brand-lavanda/50">
                          {format(new Date(e.data_inicio), "d MMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {e.clientes?.nome && <p className="text-xs text-brand-lavanda/30">{e.clientes.nome}</p>}
                      </div>
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
                {Object.entries(tipoConfig).map(([key, tc]) => {
                  const Icon = tc.icon
                  return (
                    <div key={key} className="flex items-center gap-2.5 text-xs text-brand-lavanda/70">
                      <div className={cn('h-3 w-3 rounded-full shrink-0', tc.cor)} />
                      {tc.label}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

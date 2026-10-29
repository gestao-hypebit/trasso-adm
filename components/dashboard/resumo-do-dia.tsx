'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { endOfDay, format, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, CheckSquare, FileText, Loader2, MessageCircle, PhoneCall, Sun, Video } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { cn, whatsappUrl } from '@/lib/utils'
import { diaSP } from '@/lib/anuncios/regras'
import { situacaoContato } from '@/lib/leads/contatos'
import { mensagemWhatsapp } from '@/lib/leads/proximo-passo'
import { labelFrenteLead } from '@/lib/leads/frente'
import { leadStatusConfig, type LeadStatus } from '@/lib/leads/formulario'

type LeadResumo = { id: string; nome: string; empresa: string | null; telefone: string | null; status: string; frente: string; proximo_contato: string | null; etapa_desde: string; formulario_id: string | null }
type EventoResumo = { id: string; titulo: string; data_inicio: string; dia_inteiro?: boolean; link_meet: string | null; google_event_id?: string | null }
type TarefaResumo = { id: string; titulo: string; data_vencimento: string; projetos: { nome: string } | null }

const ABERTOS = ['novo', 'em_contato', 'qualificado', 'proposta']
// Proposta sem resposta há mais que isso entra na lista para cobrar.
const DIAS_PROPOSTA = 5
const MAX_ITENS = 5
const DIA = 86_400_000

const diasParado = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DIA)

function Coluna({ titulo, icone: Icone, cor, total, href, vazio, carregando, children }: {
  titulo: string
  icone: typeof Sun
  cor: string
  total: number
  href: string
  vazio: string
  carregando: boolean
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icone className={cn('h-4 w-4 shrink-0', cor)} />
        <Link href={href} className="text-sm font-semibold text-brand-lavanda hover:underline">{titulo}</Link>
        {!carregando && total > 0 && (
          <span className="ml-auto rounded-full bg-white/[0.06] px-2 text-[11px] font-semibold leading-5 text-brand-lavanda/80">{total}</span>
        )}
      </div>
      {carregando ? (
        <p className="flex items-center gap-2 text-xs text-brand-lavanda/40"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…</p>
      ) : total === 0 ? (
        <p className="text-xs text-brand-lavanda/40">{vazio}</p>
      ) : (
        <ul className="space-y-1.5">{children}</ul>
      )}
      {!carregando && total > MAX_ITENS && (
        <Link href={href} className="mt-2 block text-[11px] text-brand-lavanda/50 hover:text-brand-lavanda">+{total - MAX_ITENS} — ver todos</Link>
      )}
    </div>
  )
}

function Item({ href, children, acao }: { href: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Link href={href} className="min-w-0 flex-1 rounded-md px-1.5 py-1 -mx-1.5 text-xs hover:bg-white/[0.04]">{children}</Link>
      {acao}
    </li>
  )
}

function BotaoZap({ href }: { href: string | null }) {
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noreferrer" title="Chamar no WhatsApp" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-lavanda/40 hover:bg-white/[0.06] hover:text-brand-lima">
      <MessageCircle className="h-3.5 w-3.5" />
    </a>
  )
}

// O que precisa de atenção hoje: quem chamar, o que está na agenda, propostas paradas e tarefas vencendo.
export function ResumoDoDia() {
  const [leads, setLeads] = useState<LeadResumo[]>([])
  const [eventos, setEventos] = useState<EventoResumo[]>([])
  const [tarefas, setTarefas] = useState<TarefaResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [carregandoGoogle, setCarregandoGoogle] = useState(true)
  const hoje = diaSP(new Date())

  useEffect(() => {
    const supabase = createClient() as any
    const inicio = startOfDay(new Date()).toISOString()
    const fim = endOfDay(new Date()).toISOString()

    Promise.all([
      supabase.from('leads').select('id, nome, empresa, telefone, status, frente, proximo_contato, etapa_desde, formulario_id').in('status', ABERTOS),
      supabase.from('eventos').select('id, titulo, data_inicio, link_meet, google_event_id').gte('data_inicio', inicio).lte('data_inicio', fim).order('data_inicio'),
      supabase.from('tarefas').select('id, titulo, data_vencimento, projetos(nome)').is('concluida_em', null).not('data_vencimento', 'is', null).lte('data_vencimento', hoje).order('data_vencimento'),
    ]).then(([l, e, t]: { data: unknown[] | null }[]) => {
      setLeads((l.data as LeadResumo[]) ?? [])
      setEventos((e.data as EventoResumo[]) ?? [])
      setTarefas((t.data as TarefaResumo[]) ?? [])
      setCarregando(false)
    })

    // Compromissos do Google de hoje (se estiver conectado).
    fetch(`/api/google-calendar/events?timeMin=${encodeURIComponent(inicio)}&timeMax=${encodeURIComponent(fim)}`)
      .then((r) => r.json())
      .then((d: { events?: (EventoResumo & { gcal_id: string })[] }) => {
        const doGoogle = (d.events ?? []).map((g) => ({ ...g, google_event_id: g.gcal_id }))
        setEventos((prev) => {
          const ja = new Set(prev.map((x) => x.google_event_id).filter(Boolean))
          return [...prev, ...doGoogle.filter((g) => !ja.has(g.google_event_id))]
        })
      })
      .catch(() => {})
      .finally(() => setCarregandoGoogle(false))
  }, [hoje])

  // Atrasados primeiro, depois os de hoje; leads novos do site que ninguém chamou também entram.
  const falarHoje = leads
    .filter((l) => {
      const s = situacaoContato(l.proximo_contato, hoje)
      return s === 'atrasado' || s === 'hoje' || (l.status === 'novo' && l.formulario_id && !l.proximo_contato)
    })
    .sort((a, b) => (a.proximo_contato ?? '9999').localeCompare(b.proximo_contato ?? '9999'))

  const propostasParadas = leads
    .filter((l) => l.status === 'proposta' && diasParado(l.etapa_desde) >= DIAS_PROPOSTA)
    .sort((a, b) => a.etapa_desde.localeCompare(b.etapa_desde))

  const agendaHoje = [...eventos].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
  const agora = Date.now()

  const tudoEmDia = !carregando && !carregandoGoogle && falarHoje.length + agendaHoje.length + propostasParadas.length + tarefas.length === 0

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="flex items-center gap-2 text-base font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            <Sun className="h-4 w-4 text-brand-lima" /> Resumo do dia
          </h2>
          <span className="text-xs capitalize text-brand-lavanda/40">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
          {tudoEmDia && <span className="text-xs text-brand-lima">Tudo em dia por hoje ✓</span>}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Coluna titulo="Falar hoje" icone={PhoneCall} cor="text-brand-rosa" total={falarHoje.length} href="/leads" vazio="Ninguém para chamar hoje." carregando={carregando}>
            {falarHoje.slice(0, MAX_ITENS).map((l) => {
              const s = situacaoContato(l.proximo_contato, hoje)
              return (
                <Item
                  key={l.id}
                  href={`/leads?lead=${l.id}`}
                  acao={<BotaoZap href={whatsappUrl(l.telefone, l.status === 'novo' ? mensagemWhatsapp.primeiroContato(l.nome, labelFrenteLead(l.frente)) : undefined)} />}
                >
                  <span className="block truncate text-brand-lavanda">{l.nome}{l.empresa && <span className="text-brand-lavanda/40"> · {l.empresa}</span>}</span>
                  <span className={cn('text-[11px]', s === 'atrasado' ? 'text-brand-rosa' : 'text-brand-lavanda/40')}>
                    {s === 'atrasado' ? `Atrasado desde ${format(new Date(`${l.proximo_contato}T12:00:00`), 'dd/MM')}` : s === 'hoje' ? 'Hoje' : 'Novo do site, sem contato'}
                    {' · '}{leadStatusConfig[l.status as LeadStatus]?.label ?? l.status}
                  </span>
                </Item>
              )
            })}
          </Coluna>

          <Coluna titulo="Agenda de hoje" icone={CalendarDays} cor="text-brand-violeta" total={agendaHoje.length} href="/agenda" vazio="Nada marcado para hoje." carregando={carregando || (carregandoGoogle && agendaHoje.length === 0)}>
            {agendaHoje.slice(0, MAX_ITENS).map((e) => {
              const passou = !e.dia_inteiro && new Date(e.data_inicio).getTime() + 3_600_000 < agora
              return (
                <Item
                  key={e.id}
                  href="/agenda"
                  acao={e.link_meet && !passou ? (
                    <a href={e.link_meet} target="_blank" rel="noreferrer" title="Entrar no Meet" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-lavanda/40 hover:bg-white/[0.06] hover:text-brand-lima">
                      <Video className="h-3.5 w-3.5" />
                    </a>
                  ) : undefined}
                >
                  <span className={cn('block truncate', passou ? 'text-brand-lavanda/40 line-through' : 'text-brand-lavanda')}>
                    <span className="mr-1.5 font-semibold">{e.dia_inteiro ? 'Dia todo' : format(new Date(e.data_inicio), 'HH:mm')}</span>
                    {e.titulo}
                  </span>
                </Item>
              )
            })}
          </Coluna>

          <Coluna titulo="Propostas sem resposta" icone={FileText} cor="text-yellow-400" total={propostasParadas.length} href="/leads" vazio={`Nenhuma proposta parada há ${DIAS_PROPOSTA}+ dias.`} carregando={carregando}>
            {propostasParadas.slice(0, MAX_ITENS).map((l) => (
              <Item key={l.id} href={`/leads?lead=${l.id}`} acao={<BotaoZap href={whatsappUrl(l.telefone, mensagemWhatsapp.cobrarProposta(l.nome))} />}>
                <span className="block truncate text-brand-lavanda">{l.empresa || l.nome}</span>
                <span className="text-[11px] text-yellow-400/80">Enviada há {diasParado(l.etapa_desde)} dias</span>
              </Item>
            ))}
          </Coluna>

          <Coluna titulo="Tarefas vencendo" icone={CheckSquare} cor="text-brand-lima" total={tarefas.length} href="/tarefas" vazio="Nenhuma tarefa vence hoje." carregando={carregando}>
            {tarefas.slice(0, MAX_ITENS).map((t) => (
              <Item key={t.id} href="/tarefas">
                <span className="block truncate text-brand-lavanda">{t.titulo}</span>
                <span className={cn('text-[11px]', t.data_vencimento < hoje ? 'text-brand-rosa' : 'text-brand-lavanda/40')}>
                  {t.data_vencimento < hoje ? `Atrasada · ${format(new Date(`${t.data_vencimento}T12:00:00`), 'dd/MM')}` : 'Vence hoje'}
                  {t.projetos?.nome && ` · ${t.projetos.nome}`}
                </span>
              </Item>
            ))}
          </Coluna>
        </div>
      </CardContent>
    </Card>
  )
}

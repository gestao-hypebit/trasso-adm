'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DollarSign, FolderOpen, FileText, Users, Clock, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ChevronDown, Wallet, Activity, MessageCircle, FileCheck, FileSignature, CheckSquare } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Lancamento = { tipo: string; valor: number; data: string; status: string; descricao: string; categorias_financeiras: { nome: string } | null }
type Projeto = { id: string; status: string; data_entrega: string | null; nome: string }
type PropostaCount = { id: string }
type ClienteAll = { id: string; created_at: string }

type AtividadeTipo = 'interacao' | 'proposta_aprovada' | 'contrato_assinado' | 'tarefa_concluida'
type Atividade = { id: string; tipo: AtividadeTipo; titulo: string; subtitulo: string | null; timestamp: string; href: string }

const ATIVIDADE_ICONS: Record<AtividadeTipo, React.FC<any>> = {
  interacao: MessageCircle, proposta_aprovada: FileCheck, contrato_assinado: FileSignature, tarefa_concluida: CheckSquare,
}
const ATIVIDADE_CORES: Record<AtividadeTipo, string> = {
  interacao: 'text-brand-violeta', proposta_aprovada: 'text-brand-lima', contrato_assinado: 'text-brand-lima', tarefa_concluida: 'text-brand-rosa',
}

const STATUS_CORES: Record<string, string> = {
  em_andamento: '#7C3AED',
  aguardando_cliente: '#B8F000',
  em_revisao: '#FF4D8D',
  concluido: '#5B21B6',
  backlog: '#F59E0B',
}

const STATUS_LABELS: Record<string, string> = {
  em_andamento: 'Em Andamento',
  aguardando_cliente: 'Aguardando',
  em_revisao: 'Em Revisão',
  concluido: 'Concluído',
  backlog: 'Backlog',
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#141318] border border-white/[0.1] rounded-xl p-3 text-xs">
      <p className="text-brand-lavanda font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill ?? p.color }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [propostas, setPropostas] = useState<PropostaCount[]>([])
  const [clientesAll, setClientesAll] = useState<ClienteAll[]>([])
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [loading, setLoading] = useState(true)

  // Mês selecionado (filtro)
  const [mesSel, setMesSel] = useState(() => startOfMonth(new Date()))
  const [allTime, setAllTime] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear())
  const mesStart = allTime ? '0000-01-01' : format(mesSel, 'yyyy-MM-01')
  const mesEnd = allTime ? '9999-12-31' : format(endOfMonth(mesSel), 'yyyy-MM-dd')
  const mesLabel = allTime ? 'Desde o início' : format(mesSel, 'MMMM yyyy', { locale: ptBR })
  const isCurrentMes = !allTime && format(mesSel, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  useEffect(() => {
    const supabase = createClient() as any
    async function load() {
      const [{ data: l }, { data: p }, { data: prop }, { data: cl }, { data: interacoes }, { data: propAprovadas }, { data: contratosAssinados }, { data: tarefasConcluidas }] = await Promise.all([
        supabase.from('lancamentos').select('tipo, valor, data, status, descricao, categorias_financeiras(nome)').order('data', { ascending: true }),
        supabase.from('projetos').select('id, status, data_entrega, nome').order('created_at', { ascending: false }),
        supabase.from('propostas').select('id').in('status', ['enviada', 'em_negociacao']),
        supabase.from('clientes').select('id, created_at'),
        supabase.from('interacoes').select('id, titulo, data, clientes(id, nome)').order('data', { ascending: false }).limit(8),
        supabase.from('propostas').select('id, numero, titulo, aprovada_em, clientes(nome)').not('aprovada_em', 'is', null).order('aprovada_em', { ascending: false }).limit(8),
        supabase.from('contratos').select('id, numero, titulo, assinado_em, clientes(nome)').not('assinado_em', 'is', null).order('assinado_em', { ascending: false }).limit(8),
        supabase.from('tarefas').select('id, titulo, concluida_em, projeto_id, projetos(nome)').not('concluida_em', 'is', null).order('concluida_em', { ascending: false }).limit(8),
      ])
      setLancamentos((l as Lancamento[]) ?? [])
      setProjetos(p ?? [])
      setPropostas(prop ?? [])
      setClientesAll(cl ?? [])

      const feed: Atividade[] = [
        ...(interacoes ?? []).map((i: any) => ({
          id: `interacao-${i.id}`, tipo: 'interacao' as const, titulo: i.titulo,
          subtitulo: i.clientes?.nome ?? null, timestamp: i.data, href: i.clientes?.id ? `/clientes/${i.clientes.id}` : '/clientes',
        })),
        ...(propAprovadas ?? []).map((p: any) => ({
          id: `proposta-${p.id}`, tipo: 'proposta_aprovada' as const, titulo: `Proposta aprovada · ${p.numero}`,
          subtitulo: p.clientes?.nome ?? p.titulo, timestamp: p.aprovada_em, href: `/propostas/${p.id}`,
        })),
        ...(contratosAssinados ?? []).map((c: any) => ({
          id: `contrato-${c.id}`, tipo: 'contrato_assinado' as const, titulo: `Contrato assinado · ${c.numero}`,
          subtitulo: c.clientes?.nome ?? c.titulo, timestamp: c.assinado_em, href: `/contratos/${c.id}`,
        })),
        ...(tarefasConcluidas ?? []).map((t: any) => ({
          id: `tarefa-${t.id}`, tipo: 'tarefa_concluida' as const, titulo: t.titulo,
          subtitulo: t.projetos?.nome ?? null, timestamp: t.concluida_em, href: t.projeto_id ? `/projetos/${t.projeto_id}` : '/tarefas',
        })),
      ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8)
      setAtividades(feed)

      setLoading(false)
    }
    load()
  }, [])

  // KPIs do mês selecionado
  const doMes = lancamentos.filter(l => l.data >= mesStart && l.data <= mesEnd)
  const clientesMes = clientesAll.filter(c => c.created_at >= `${mesStart}T00:00:00` && c.created_at <= `${mesEnd}T23:59:59`)
  const faturamento = doMes.filter(l => l.tipo === 'receita' && l.status === 'recebido').reduce((s, l) => s + l.valor, 0)
  const projetosAtivos = projetos.filter(p => p.status === 'em_andamento').length

  // Gráfico histórico (todos os meses com dados)
  const revenueData = (() => {
    const porMes: Record<string, { agencia: number; despesa: number; mesKey: string }> = {}
    for (const l of lancamentos) {
      if (l.status !== 'recebido' && l.status !== 'pago') continue
      const k = l.data.slice(0, 7)
      if (!porMes[k]) porMes[k] = { agencia: 0, despesa: 0, mesKey: k }
      if (l.tipo === 'receita') porMes[k].agencia += l.valor
      if (l.tipo === 'despesa') porMes[k].despesa += l.valor
    }
    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => {
        const lbl = format(new Date(k + '-01T12:00:00Z'), 'MMM/yy', { locale: ptBR })
        const isSel = k === format(mesSel, 'yyyy-MM')
        return { mes: lbl.charAt(0).toUpperCase() + lbl.slice(1), ...v, isSel }
      })
  })()

  const projetosStatusData = Object.entries(
    projetos.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc }, {} as Record<string, number>)
  ).map(([status, value]) => ({ name: STATUS_LABELS[status] || status, value, color: STATUS_CORES[status] || '#5B21B6' }))

  const proximosVencimentos = projetos
    .filter(p => p.data_entrega && p.status !== 'concluido' && p.status !== 'cancelado')
    .sort((a, b) => (a.data_entrega ?? '').localeCompare(b.data_entrega ?? ''))
    .slice(0, 6)

  const recenteLancamentos = [...doMes]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 5)

  const saldoAtual = lancamentos.reduce((s, l) => {
    if (l.tipo === 'receita' && l.status === 'recebido') return s + l.valor
    if (l.tipo === 'despesa' && l.status === 'pago') return s - l.valor
    return s
  }, 0)

  return (
    <div>
      <Header title="Dashboard" description="Visão geral da Trasso" />
      <div className="p-6 space-y-6">

        {/* Seletor de mês */}
        <div className="flex items-center gap-3">
          {!allTime && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <button
                onClick={() => setMesSel(d => subMonths(d, 1))}
                className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="relative">
                <button
                  onClick={() => { setPickerYear(mesSel.getFullYear()); setShowPicker(v => !v) }}
                  className="flex items-center gap-1 text-sm font-medium text-brand-lavanda min-w-[120px] justify-center capitalize hover:text-brand-lavanda/80 transition-colors"
                >
                  {mesLabel}
                  <ChevronDown className="h-3 w-3 text-brand-lavanda/40 shrink-0" />
                </button>
                {showPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 rounded-xl border border-white/[0.1] bg-[#1A0533] shadow-2xl p-3 w-56">
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={() => setPickerYear(y => y - 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-semibold text-brand-lavanda">{pickerYear}</span>
                        <button onClick={() => setPickerYear(y => y + 1)} disabled={pickerYear >= new Date().getFullYear()} className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {Array.from({ length: 12 }, (_, i) => {
                          const d = new Date(pickerYear, i, 1)
                          const isSelected = format(d, 'yyyy-MM') === format(mesSel, 'yyyy-MM')
                          const isFuture = d > new Date()
                          const lbl = format(d, 'MMM', { locale: ptBR })
                          return (
                            <button
                              key={i}
                              disabled={isFuture}
                              onClick={() => { setMesSel(startOfMonth(d)); setAllTime(false); setShowPicker(false) }}
                              className={cn('py-1.5 rounded-lg text-xs transition-colors capitalize', isSelected ? 'bg-brand-lima text-brand-noite font-semibold' : 'text-brand-lavanda/60 hover:bg-white/[0.06] hover:text-brand-lavanda', isFuture && 'opacity-25 cursor-not-allowed')}
                            >
                              {lbl.charAt(0).toUpperCase() + lbl.slice(1, 3)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setMesSel(d => addMonths(d, 1))}
                disabled={isCurrentMes}
                className="flex h-6 w-6 items-center justify-center rounded-md text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.06] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {allTime && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-lima/30 bg-brand-lima/[0.04] px-4 py-2">
              <span className="text-sm font-medium text-brand-lima">Desde o início</span>
            </div>
          )}
          <button
            onClick={() => setAllTime(v => !v)}
            className={cn('text-xs px-3 py-1.5 rounded-lg border transition-colors', allTime ? 'border-brand-lima/30 text-brand-lima bg-brand-lima/[0.08] hover:bg-brand-lima/[0.12]' : 'border-white/[0.08] text-brand-lavanda/40 hover:text-brand-lavanda/70 hover:border-white/[0.14]')}
          >
            {allTime ? 'Ver por mês' : 'Desde o início'}
          </button>
          {!allTime && !isCurrentMes && (
            <button
              onClick={() => setMesSel(startOfMonth(new Date()))}
              className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 transition-colors"
            >
              Mês atual
            </button>
          )}
        </div>

        {/* Saldo em Conta */}
        <div className="rounded-2xl border border-brand-lima/25 bg-gradient-to-r from-brand-lima/[0.07] to-transparent p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-brand-lavanda/50 mb-1 uppercase tracking-wide">Saldo em Conta</p>
            <p className={cn('text-3xl font-bold', saldoAtual >= 0 ? 'text-brand-lima' : 'text-brand-rosa')} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {loading ? '...' : formatCurrency(saldoAtual)}
            </p>
            <p className="text-xs text-brand-lavanda/30 mt-1">Total recebido − Total pago · histórico completo</p>
          </div>
          <Wallet className="h-8 w-8 text-brand-lima/25 shrink-0" />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="sm:col-span-2 lg:col-span-1">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-brand-lavanda/40 mb-3">Receita Total</p>
                  <p className="text-2xl font-bold text-brand-lima" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {loading ? '...' : formatCurrency(faturamento)}
                  </p>
                </div>
                <DollarSign className="h-5 w-5 shrink-0 text-brand-lima" />
              </div>
            </CardContent>
          </Card>
          <KpiCard title="Projetos Ativos" value={loading ? '...' : String(projetosAtivos)} icon={FolderOpen} iconColor="text-brand-violeta" />
          <KpiCard title="Propostas em Aberto" value={loading ? '...' : String(propostas.length)} icon={FileText} iconColor="text-brand-rosa" />
          <KpiCard title="Novos Clientes" value={loading ? '...' : String(clientesMes.length)} icon={Users} iconColor="text-brand-lima" />
        </div>

        {/* Gráfico histórico */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Receita x Despesa — últimos 12 meses</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-brand-lavanda/30 text-sm">
                  {loading ? 'Carregando...' : 'Sem dados financeiros ainda'}
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={revenueData} barGap={2} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fill: '#F5F2FF60', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#F5F2FF60', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v === 0 ? '' : `${(v/1000).toFixed(0)}k`} width={36} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="agencia" name="Receita" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesa" name="Despesa" fill="#FF4D8D" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-2 justify-end">
                    <span className="flex items-center gap-1.5 text-[11px] text-brand-lavanda/50">
                      <span className="h-2 w-2 rounded-sm bg-brand-violeta" /> Receita
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-brand-lavanda/50">
                      <span className="h-2 w-2 rounded-sm bg-brand-rosa/50" /> Despesa
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Projetos por Status</CardTitle></CardHeader>
            <CardContent>
              {projetos.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-brand-lavanda/30 text-sm">
                  {loading ? 'Carregando...' : 'Sem projetos'}
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={projetosStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                        {projetosStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value) => [value, 'projetos']} contentStyle={{ background: '#141318', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {projetosStatusData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                          <span className="text-brand-lavanda/70">{item.name}</span>
                        </div>
                        <span className="font-semibold text-brand-lavanda">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lançamentos + Vencimentos */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Lançamentos — <span className="capitalize font-normal text-brand-lavanda/50">{mesLabel}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-xs text-brand-lavanda/40 text-center py-4">Carregando...</p>
              ) : recenteLancamentos.length === 0 ? (
                <p className="text-xs text-brand-lavanda/40 text-center py-4">Nenhum lançamento neste mês.</p>
              ) : recenteLancamentos.map((l, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', l.tipo === 'receita' ? 'bg-brand-lima/10' : 'bg-brand-rosa/10')}>
                    {l.tipo === 'receita' ? <TrendingUp className="h-4 w-4 text-brand-lima" /> : <TrendingDown className="h-4 w-4 text-brand-rosa" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-brand-lavanda truncate">{l.descricao}</p>
                    <p className="text-xs text-brand-lavanda/40 mt-0.5">{l.categorias_financeiras?.nome ?? '—'} • {formatDate(l.data)}</p>
                  </div>
                  <p className={cn('text-sm font-semibold shrink-0', l.tipo === 'receita' ? 'text-brand-lima' : 'text-brand-rosa')}>
                    {l.tipo === 'receita' ? '+' : '-'}{formatCurrency(l.valor)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Próximas Entregas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-xs text-brand-lavanda/40 text-center py-4">Carregando...</p>
              ) : proximosVencimentos.length === 0 ? (
                <p className="text-xs text-brand-lavanda/40 text-center py-4">Nenhuma entrega próxima.</p>
              ) : proximosVencimentos.map((p) => {
                const urgente = p.data_entrega! <= format(new Date(Date.now() + 3 * 86400000), 'yyyy-MM-dd')
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-3 min-w-0">
                      <Clock className={cn('h-4 w-4 shrink-0', urgente ? 'text-brand-rosa' : 'text-brand-lavanda/40')} />
                      <p className="text-sm text-brand-lavanda truncate">{p.nome}</p>
                    </div>
                    <p className={cn('text-xs font-medium shrink-0', urgente ? 'text-brand-rosa' : 'text-brand-lavanda/60')}>
                      {formatDate(p.data_entrega)}
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Atividade Recente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-violeta" /> Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-xs text-brand-lavanda/40 text-center py-4">Carregando...</p>
            ) : atividades.length === 0 ? (
              <p className="text-xs text-brand-lavanda/40 text-center py-4">Nenhuma atividade recente.</p>
            ) : atividades.map((a) => {
              const Icon = ATIVIDADE_ICONS[a.tipo]
              return (
                <Link key={a.id} href={a.href} className="flex items-start gap-3 -mx-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <Icon className={cn('h-4 w-4', ATIVIDADE_CORES[a.tipo])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-brand-lavanda truncate">{a.titulo}</p>
                    <p className="text-xs text-brand-lavanda/40 mt-0.5">{a.subtitulo ? `${a.subtitulo} • ` : ''}{formatDate(a.timestamp, 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

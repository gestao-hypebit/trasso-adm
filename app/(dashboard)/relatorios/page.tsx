'use client'

import { useState, useEffect } from 'react'
import { Download, TrendingUp, TrendingDown, Users, FolderOpen } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const tabItems = [
  { key: 'financeiro', label: 'Financeiro', icon: TrendingUp },
  { key: 'projetos', label: 'Projetos', icon: FolderOpen },
  { key: 'crm', label: 'CRM', icon: Users },
]

const STATUS_CORES: Record<string, string> = {
  concluido: '#B8F000', em_andamento: '#7C3AED', aguardando_cliente: '#F59E0B',
  em_revisao: '#FF4D8D', backlog: '#5B21B6', cancelado: '#374151',
}
const STATUS_LABELS: Record<string, string> = {
  concluido: 'Concluído', em_andamento: 'Em Andamento', aguardando_cliente: 'Aguardando',
  em_revisao: 'Em Revisão', backlog: 'Backlog', cancelado: 'Cancelado',
}
const TIPO_LABELS: Record<string, string> = {
  identidade_visual: 'ID Visual', site: 'Site', software: 'Software',
  marketing: 'Marketing', social_media: 'Social Media', outro: 'Outro',
}
const PROPOSTA_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', enviada: 'Enviada', em_negociacao: 'Em Negociação',
  aprovada: 'Aprovada', recusada: 'Recusada',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl">
      <p className="text-brand-lavanda/60 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.value > 999 ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function RelatoriosPage() {
  const [aba, setAba] = useState('financeiro')
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [saasClientes, setSaasClientes] = useState<any[]>([])
  const [projetos, setProjetos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [propostas, setPropostas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const db = supabase as any
    async function load() {
      const [{ data: l }, { data: p }, { data: c }, { data: prop }, { data: sc }] = await Promise.all([
        supabase.from('lancamentos').select('tipo, valor, data, status, cliente_id, clientes(nome)').in('status', ['recebido', 'pago']),
        supabase.from('projetos').select('id, status, tipo, created_at'),
        supabase.from('clientes').select('id, origem, created_at'),
        supabase.from('propostas').select('id, status'),
        db.from('saas_clientes').select('mrr, ultimo_pagamento').in('status', ['ativo', 'trial']).not('ultimo_pagamento', 'is', null),
      ])
      setLancamentos(l ?? [])
      setSaasClientes(sc ?? [])
      setProjetos(p ?? [])
      setClientes(c ?? [])
      setPropostas(prop ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const receitaDespesaMensal = (() => {
    const porMes: Record<string, { receita: number; despesa: number }> = {}
    for (const l of lancamentos) {
      const mesKey = l.data.slice(0, 7)
      if (!porMes[mesKey]) porMes[mesKey] = { receita: 0, despesa: 0 }
      if (l.tipo === 'receita') porMes[mesKey].receita += l.valor
      if (l.tipo === 'despesa') porMes[mesKey].despesa += l.valor
    }
    for (const sc of saasClientes) {
      if (!sc.ultimo_pagamento) continue
      const mesKey = sc.ultimo_pagamento.slice(0, 7)
      if (!porMes[mesKey]) porMes[mesKey] = { receita: 0, despesa: 0 }
      porMes[mesKey].receita += sc.mrr
    }
    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mesKey, vals]) => {
        const label = format(new Date(mesKey + '-01'), 'MMM', { locale: ptBR })
        return { mes: label.charAt(0).toUpperCase() + label.slice(1), ...vals }
      })
  })()

  const receitaPorCliente = (() => {
    const acc: Record<string, number> = {}
    for (const l of lancamentos) {
      if (l.tipo !== 'receita') continue
      const nome = (l.clientes as any)?.nome ?? 'Sem cliente'
      acc[nome] = (acc[nome] || 0) + l.valor
    }
    return Object.entries(acc)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([nome, valor]) => ({ nome, valor }))
  })()

  const totalSaas = saasClientes.reduce((s: number, sc: any) => s + (sc.mrr ?? 0), 0)
  const totalReceita = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0) + totalSaas
  const totalDespesa = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)

  const projetosPorStatus = Object.entries(
    projetos.reduce((acc: any, p: any) => {
      acc[p.status] = (acc[p.status] || 0) + 1; return acc
    }, {})
  ).map(([status, value]) => ({
    name: STATUS_LABELS[status] || status, value, fill: STATUS_CORES[status] || '#5B21B6',
  }))

  const projetosPorTipo = Object.entries(
    projetos.reduce((acc: any, p: any) => {
      const tipo = p.tipo || 'outro'
      if (!acc[tipo]) acc[tipo] = { total: 0, concluido: 0 }
      acc[tipo].total++
      if (p.status === 'concluido') acc[tipo].concluido++
      return acc
    }, {})
  ).map(([tipo, vals]: any) => ({ tipo: TIPO_LABELS[tipo] || tipo, ...vals }))

  const maxTotal = Math.max(...projetosPorTipo.map((p: any) => p.total), 1)

  const clientesMensais = (() => {
    const acc: Record<string, number> = {}
    for (const c of clientes) {
      const mesKey = c.created_at.slice(0, 7)
      acc[mesKey] = (acc[mesKey] || 0) + 1
    }
    return Object.entries(acc)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mesKey, novos]) => {
        const label = format(new Date(mesKey + '-01'), 'MMM', { locale: ptBR })
        return { mes: label.charAt(0).toUpperCase() + label.slice(1), novos }
      })
  })()

  const propostasTotal = propostas.length
  const funnelPropostas = Object.entries(
    propostas.reduce((acc: any, p: any) => {
      acc[p.status] = (acc[p.status] || 0) + 1; return acc
    }, {})
  ).map(([status, count]: any) => ({
    status: PROPOSTA_LABELS[status] || status,
    count,
    pct: propostasTotal > 0 ? Math.round((count / propostasTotal) * 100) : 0,
  })).sort((a, b) => b.count - a.count)

  const clientesPorOrigem = Object.entries(
    clientes.reduce((acc: any, c: any) => {
      const origem = c.origem || 'outros'
      acc[origem] = (acc[origem] || 0) + 1; return acc
    }, {})
  ).map(([origem, count]: any) => ({
    origem: origem.charAt(0).toUpperCase() + origem.slice(1),
    count,
    pct: clientes.length > 0 ? Math.round((count / clientes.length) * 100) : 0,
  }))

  const ticketMedio = clientes.length > 0 ? totalReceita / clientes.length : 0
  const aprovadas = propostas.filter((p: any) => p.status === 'aprovada').length
  const taxaConversao = propostasTotal > 0 ? Math.round((aprovadas / propostasTotal) * 100) : 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Relatórios" description="Análises e métricas da agência" />

      <main className="flex-1 p-6">
        <PageHeader title="Relatórios">
          <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Exportar CSV</Button>
        </PageHeader>

        <div className="flex gap-1 border-b border-white/[0.06] mb-6">
          {tabItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                aba === key ? 'border-brand-lima text-brand-lima' : 'border-transparent text-brand-lavanda/60 hover:text-brand-lavanda hover:border-white/[0.12]'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {aba === 'financeiro' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Receitas', valor: totalReceita, cor: 'text-brand-lima', icon: TrendingUp, bg: 'bg-brand-lima/10' },
                { label: 'Total Despesas', valor: totalDespesa, cor: 'text-brand-rosa', icon: TrendingDown, bg: 'bg-brand-rosa/10' },
                { label: 'Resultado Líquido', valor: totalReceita - totalDespesa, cor: 'text-brand-lavanda', icon: TrendingUp, bg: 'bg-brand-violeta/10' },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', item.bg)}>
                      <item.icon className={cn('h-5 w-5', item.cor)} />
                    </div>
                    <div>
                      <p className={cn('text-2xl font-bold', item.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                        {loading ? '...' : formatCurrency(item.valor)}
                      </p>
                      <p className="text-xs text-brand-lavanda/50">{item.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Receita × Despesa Mensal</CardTitle></CardHeader>
                <CardContent>
                  {receitaDespesaMensal.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-brand-lavanda/30 text-sm">{loading ? 'Carregando...' : 'Sem dados'}</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={receitaDespesaMensal} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.15)" />
                        <XAxis dataKey="mes" tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="receita" name="Receita" fill="#B8F000" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="despesa" name="Despesa" fill="#FF4D8D" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Receita por Cliente</CardTitle></CardHeader>
                <CardContent>
                  {receitaPorCliente.length === 0 ? (
                    <p className="text-xs text-brand-lavanda/40 text-center py-12">{loading ? 'Carregando...' : 'Sem dados'}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {receitaPorCliente.map((c) => {
                        const max = receitaPorCliente[0].valor
                        const pct = (c.valor / max) * 100
                        return (
                          <div key={c.nome}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-brand-lavanda/70">{c.nome}</span>
                              <span className="text-brand-lavanda font-semibold">{formatCurrency(c.valor)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-brand-noite overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-brand-violeta to-brand-lima" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {aba === 'projetos' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total de Projetos', valor: projetos.length, sub: 'registrados' },
                { label: 'Concluídos', valor: projetos.filter(p => p.status === 'concluido').length, sub: 'projetos entregues' },
                { label: 'Em Andamento', valor: projetos.filter(p => p.status === 'em_andamento').length, sub: 'projetos ativos' },
                { label: 'Backlog', valor: projetos.filter(p => p.status === 'backlog').length, sub: 'aguardando início' },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="p-5 text-center">
                    <p className="text-3xl font-bold text-brand-lima mb-1" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                      {loading ? '...' : item.valor}
                    </p>
                    <p className="text-xs text-brand-lavanda/70">{item.label}</p>
                    <p className="text-xs text-brand-lavanda/30">{item.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Projetos por Status</CardTitle></CardHeader>
                <CardContent>
                  {projetosPorStatus.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-brand-lavanda/30 text-sm">{loading ? 'Carregando...' : 'Sem dados'}</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={projetosPorStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {projetosPorStatus.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="transparent" />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(v) => <span className="text-xs text-brand-lavanda/70">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Projetos por Tipo</CardTitle></CardHeader>
                <CardContent>
                  {projetosPorTipo.length === 0 ? (
                    <p className="text-xs text-brand-lavanda/40 text-center py-12">{loading ? 'Carregando...' : 'Sem dados'}</p>
                  ) : (
                    <div className="space-y-3">
                      {projetosPorTipo.map((p: any) => (
                        <div key={p.tipo}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-brand-lavanda/70">{p.tipo}</span>
                            <span className="text-brand-lavanda/50">{p.concluido}/{p.total} concluídos</span>
                          </div>
                          <div className="h-2 rounded-full bg-brand-noite overflow-hidden">
                            <div className="h-full rounded-full bg-brand-violeta" style={{ width: `${(p.total / maxTotal) * 100}%` }}>
                              <div className="h-full rounded-full bg-brand-lima" style={{ width: `${(p.concluido / p.total) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {aba === 'crm' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total de Clientes', valor: clientes.length, sub: 'cadastrados' },
                { label: 'Propostas Criadas', valor: propostasTotal, sub: 'total registradas' },
                { label: 'Taxa de Conversão', valor: `${taxaConversao}%`, sub: 'proposta → aprovada' },
                { label: 'Ticket Médio', valor: formatCurrency(ticketMedio), sub: 'por cliente' },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="p-5 text-center">
                    <p className="text-2xl font-bold text-brand-lima mb-1 truncate" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                      {loading ? '...' : item.valor}
                    </p>
                    <p className="text-xs text-brand-lavanda/70">{item.label}</p>
                    <p className="text-xs text-brand-lavanda/30">{item.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Novos Clientes por Mês</CardTitle></CardHeader>
                <CardContent>
                  {clientesMensais.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-brand-lavanda/30 text-sm">{loading ? 'Carregando...' : 'Sem dados'}</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={clientesMensais} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.15)" />
                        <XAxis dataKey="mes" tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(245,242,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="novos" name="Novos clientes" stroke="#7C3AED" strokeWidth={2} dot={{ fill: '#B8F000', strokeWidth: 0, r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Funil de Propostas</CardTitle></CardHeader>
                <CardContent>
                  {funnelPropostas.length === 0 ? (
                    <p className="text-xs text-brand-lavanda/40 text-center py-12">{loading ? 'Carregando...' : 'Sem dados'}</p>
                  ) : (
                    <div className="space-y-3">
                      {funnelPropostas.map((f) => (
                        <div key={f.status}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-brand-lavanda/70">{f.status}</span>
                            <span className="text-brand-lavanda font-semibold">{f.count} ({f.pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-brand-noite overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-brand-violeta to-brand-lima transition-all" style={{ width: `${f.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {clientesPorOrigem.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Clientes por Origem</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-6 justify-center">
                    {clientesPorOrigem.map((o) => (
                      <div key={o.origem} className="text-center">
                        <div className="relative h-16 w-16 mx-auto mb-2">
                          <svg className="rotate-[-90deg]" viewBox="0 0 32 32">
                            <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(124,58,237,0.2)" strokeWidth="4" />
                            <circle cx="16" cy="16" r="12" fill="none" stroke="#7C3AED" strokeWidth="4"
                              strokeDasharray={`${(o.pct / 100) * 75.4} 75.4`} />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-brand-lavanda">
                            {o.pct}%
                          </span>
                        </div>
                        <p className="text-xs text-brand-lavanda/70">{o.origem}</p>
                        <p className="text-xs text-brand-lavanda/40">{o.count} clientes</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

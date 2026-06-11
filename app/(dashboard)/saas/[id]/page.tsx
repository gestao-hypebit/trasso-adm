'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, TrendingDown, Users, DollarSign, Activity, Pencil, X, Check, RefreshCw, Zap, Copy, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Produto = { id: string; nome: string; descricao: string | null; cor: string; url: string | null; stripe_secret_key: string | null; stripe_webhook_secret: string | null; last_synced_at: string | null }
type SaasCliente = {
  id: string
  nome: string
  email: string | null
  plano: string | null
  mrr: number
  status: string
  data_inicio: string | null
  data_cancelamento: string | null
  ultimo_pagamento: string | null
  proximo_vencimento: string | null
  observacoes: string | null
}

const STATUS_BADGE: Record<string, 'ativo' | 'inativo' | 'lead' | 'urgente' | 'pendente'> = {
  ativo: 'ativo',
  trial: 'lead',
  cancelado: 'inativo',
  inadimplente: 'urgente',
}

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  trial: 'Trial',
  cancelado: 'Cancelado',
  inadimplente: 'Inadimplente',
}

const FORM_VAZIO = { nome: '', email: '', plano: '', mrr: '', status: 'trial', data_inicio: '', observacoes: '' }

export default function SaasDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [produto, setProduto] = useState<Produto | null>(null)
  const [clientes, setClientes] = useState<SaasCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [stripeOpen, setStripeOpen] = useState(false)
  const [editando, setEditando] = useState<SaasCliente | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ sincronizados?: number; erros?: number; error?: string } | null>(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [stripeForm, setStripeForm] = useState({ stripe_secret_key: '', stripe_webhook_secret: '' })
  const [showKey, setShowKey] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [copied, setCopied] = useState(false)

  async function load() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('produtos').select('id, nome, descricao, cor, url, stripe_secret_key, stripe_webhook_secret, last_synced_at').eq('id', id).single() as Promise<{ data: Produto | null }>,
      supabase.from('saas_clientes').select('*').eq('produto_id', id).order('created_at', { ascending: false }) as Promise<{ data: SaasCliente[] | null }>,
    ])
    setProduto(p)
    setClientes((c as SaasCliente[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModalOpen(true)
  }

  function abrirEdicao(c: SaasCliente) {
    setEditando(c)
    setForm({
      nome: c.nome,
      email: c.email ?? '',
      plano: c.plano ?? '',
      mrr: String(c.mrr),
      status: c.status,
      data_inicio: c.data_inicio ?? '',
      observacoes: c.observacoes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    const supabase = createClient()
    const payload = {
      produto_id: id,
      nome: form.nome.trim(),
      email: form.email || null,
      plano: form.plano || null,
      mrr: parseFloat(form.mrr) || 0,
      status: form.status,
      data_inicio: form.data_inicio || null,
      observacoes: form.observacoes || null,
    }
    if (editando) {
      await (supabase as any).from('saas_clientes').update(payload).eq('id', editando.id)
    } else {
      await (supabase as any).from('saas_clientes').insert(payload)
    }
    setModalOpen(false)
    setSalvando(false)
    setLoading(true)
    load()
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch(`/api/stripe/sync/${id}`, { method: 'POST' })
    const data = await res.json().catch(() => ({ error: `Erro ${res.status} — verifique o terminal do servidor` }))
    setSyncResult(data)
    setSyncing(false)
    load()
  }

  async function handleSalvarStripe() {
    const supabase = createClient() as any
    await supabase.from('produtos').update({
      stripe_secret_key: stripeForm.stripe_secret_key || null,
      stripe_webhook_secret: stripeForm.stripe_webhook_secret || null,
    }).eq('id', id)
    setStripeOpen(false)
    load()
  }

  function handleCopyWebhook() {
    const url = `${window.location.origin}/api/stripe/webhook/${id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCancelar(cliente: SaasCliente) {
    const supabase = createClient()
    await (supabase as any)
      .from('saas_clientes')
      .update({ status: 'cancelado', data_cancelamento: new Date().toISOString().slice(0, 10) })
      .eq('id', cliente.id)
    load()
  }

  async function handleReativar(cliente: SaasCliente) {
    const supabase = createClient()
    await (supabase as any)
      .from('saas_clientes')
      .update({ status: 'ativo', data_cancelamento: null })
      .eq('id', cliente.id)
    load()
  }

  const ativos = clientes.filter(c => c.status === 'ativo')
  const trials = clientes.filter(c => c.status === 'trial')
  const cancelados = clientes.filter(c => c.status === 'cancelado')
  const mrr = ativos.reduce((s, c) => s + c.mrr, 0)
  const arr = mrr * 12
  const ticketMedio = ativos.length ? mrr / ativos.length : 0

  const clientesFiltrados = filtroStatus === 'todos' ? clientes : clientes.filter(c => c.status === filtroStatus)

  if (loading) return <div className="p-6 text-brand-lavanda/40 text-sm">Carregando...</div>
  if (!produto) return (
    <div className="p-6">
      <Link href="/saas"><Button variant="outline" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button></Link>
      <p className="mt-6 text-brand-lavanda/50">Produto não encontrado.</p>
    </div>
  )

  return (
    <div>
      <Header title={produto.nome} description="Gestão de assinantes" />
      <div className="p-6 space-y-6">

        {/* Breadcrumb + ações */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/saas">
              <Button variant="ghost" size="sm" className="gap-2 -ml-2">
                <ArrowLeft className="h-4 w-4" /> Produtos
              </Button>
            </Link>
            <span className="text-brand-lavanda/20">/</span>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-md shrink-0" style={{ background: produto.cor }} />
              <span className="text-sm font-semibold text-brand-lavanda">{produto.nome}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {produto.stripe_secret_key && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
                {syncing ? 'Sincronizando...' : 'Sincronizar Stripe'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setStripeForm({
                  stripe_secret_key: produto.stripe_secret_key ?? '',
                  stripe_webhook_secret: produto.stripe_webhook_secret ?? '',
                })
                setStripeOpen(true)
              }}
            >
              <Zap className="h-3.5 w-3.5" />
              {produto.stripe_secret_key ? 'Config. Stripe' : 'Conectar Stripe'}
            </Button>
            <Button onClick={abrirNovo} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Assinante
            </Button>
          </div>
        </div>

        {/* Feedback sync */}
        {syncResult && (
          <div className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-3 text-sm',
            syncResult.error
              ? 'bg-brand-rosa/10 text-brand-rosa border border-brand-rosa/20'
              : syncResult.erros === 0
                ? 'bg-brand-lima/10 text-brand-lima border border-brand-lima/20'
                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
          )}>
            <AlertCircle className="h-4 w-4 shrink-0" />
            {syncResult.error
              ? syncResult.error
              : `${syncResult.sincronizados} assinante${syncResult.sincronizados !== 1 ? 's' : ''} sincronizado${syncResult.sincronizados !== 1 ? 's' : ''} do Stripe.${syncResult.erros! > 0 ? ` ${syncResult.erros} erro(s).` : ''}`
            }
          </div>
        )}

        {/* Banner Stripe não configurado */}
        {!produto.stripe_secret_key && (
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="flex items-center gap-3">
              <Zap className="h-4 w-4 text-brand-lavanda/40" />
              <div>
                <p className="text-sm font-medium text-brand-lavanda/70">Stripe não conectado</p>
                <p className="text-xs text-brand-lavanda/40">Conecte para importar assinantes automaticamente</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => { setStripeForm({ stripe_secret_key: '', stripe_webhook_secret: '' }); setStripeOpen(true) }}
            >
              <Zap className="h-3.5 w-3.5" /> Conectar
            </Button>
          </div>
        )}

        {/* Último sync */}
        {produto.last_synced_at && (
          <p className="text-xs text-brand-lavanda/30 -mt-3">
            Última sincronização: {new Date(produto.last_synced_at).toLocaleString('pt-BR')}
          </p>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-brand-lavanda/40 mb-3">MRR</p>
                  <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {formatCurrency(mrr)}
                  </p>
                </div>
                <DollarSign className="h-5 w-5 text-brand-lima shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-brand-lavanda/40 mb-3">ARR</p>
                  <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {formatCurrency(arr)}
                  </p>
                </div>
                <Activity className="h-5 w-5 text-brand-violeta shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-brand-lavanda/40 mb-3">Assinantes Ativos</p>
                  <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {ativos.length}
                    {trials.length > 0 && (
                      <span className="text-sm font-normal text-brand-lavanda/40 ml-2">+{trials.length} trial</span>
                    )}
                  </p>
                </div>
                <Users className="h-5 w-5 text-brand-lima shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-brand-lavanda/40 mb-3">Ticket Médio</p>
                  <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {formatCurrency(ticketMedio)}
                  </p>
                </div>
                <TrendingDown className="h-5 w-5 text-brand-lavanda/30 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de clientes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Assinantes</CardTitle>
              <div className="flex gap-1">
                {(['todos', 'ativo', 'trial', 'cancelado', 'inadimplente'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFiltroStatus(s)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      filtroStatus === s
                        ? 'bg-white/[0.1] text-brand-lavanda'
                        : 'text-brand-lavanda/40 hover:text-brand-lavanda/70'
                    )}
                  >
                    {s === 'todos' ? 'Todos' : STATUS_LABELS[s]}
                    {s !== 'todos' && (
                      <span className="ml-1.5 text-brand-lavanda/30">
                        {clientes.filter(c => c.status === s).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {clientesFiltrados.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-brand-lavanda/40">
                  {filtroStatus === 'todos' ? 'Nenhum assinante ainda.' : `Nenhum assinante com status "${STATUS_LABELS[filtroStatus]}".`}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-6 py-3 text-xs font-medium text-brand-lavanda/40">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-brand-lavanda/40">Plano</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-brand-lavanda/40">MRR</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-brand-lavanda/40">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-brand-lavanda/40">Último pgto.</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-brand-lavanda/40">Próx. cobrança</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {clientesFiltrados.map(c => {
                    const hoje = new Date()
                    hoje.setHours(0, 0, 0, 0)
                    const venc = c.proximo_vencimento ? new Date(c.proximo_vencimento + 'T12:00:00Z') : null
                    const vencido = venc ? venc < hoje : false
                    return (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5">
                        <div>
                          <p className="font-medium text-brand-lavanda">{c.nome}</p>
                          {c.email && <p className="text-xs text-brand-lavanda/40 mt-0.5">{c.email}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-brand-lavanda/70 text-xs">{c.plano ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-semibold text-brand-lavanda">
                          {c.status === 'ativo' ? formatCurrency(c.mrr) : <span className="text-brand-lavanda/30">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={STATUS_BADGE[c.status] ?? 'default'}>
                          {STATUS_LABELS[c.status] ?? c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-brand-lavanda/60">
                          {c.ultimo_pagamento ? formatDate(c.ultimo_pagamento) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {venc ? (
                          <div>
                            <span className={cn('text-xs font-medium', vencido ? 'text-brand-rosa' : 'text-yellow-400')}>
                              {formatDate(c.proximo_vencimento)}
                            </span>
                            <p className="text-[10px] text-brand-lavanda/30 mt-0.5">
                              {vencido ? 'Renovação pendente' : 'A receber'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-brand-lavanda/30">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Editar"
                            onClick={() => abrirEdicao(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {c.status !== 'cancelado' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-brand-rosa/60 hover:text-brand-rosa"
                              title="Cancelar assinatura"
                              onClick={() => handleCancelar(c)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-brand-lima/60 hover:text-brand-lima"
                              title="Reativar assinatura"
                              onClick={() => handleReativar(c)}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {cancelados.length > 0 && filtroStatus === 'todos' && (
          <p className="text-xs text-brand-lavanda/30 text-center">
            {cancelados.length} assinante{cancelados.length > 1 ? 's' : ''} cancelado{cancelados.length > 1 ? 's' : ''} — use o filtro para visualizar
          </p>
        )}
      </div>

      {/* Modal novo/editar assinante */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Assinante' : 'Novo Assinante'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome do cliente"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@dominio.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inadimplente">Inadimplente</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Input
                  placeholder="ex: Básico, Pro, Enterprise"
                  value={form.plano}
                  onChange={e => setForm(f => ({ ...f, plano: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>MRR (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={form.mrr}
                  onChange={e => setForm(f => ({ ...f, mrr: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de início</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Input
                  placeholder="Notas internas"
                  value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={salvando || !form.nome.trim()}>
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar assinante'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal configuração Stripe */}
      <Dialog open={stripeOpen} onOpenChange={setStripeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-lima" /> Configurar Stripe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">

            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-xs text-brand-lavanda/60 space-y-1.5 leading-relaxed">
              <p className="font-medium text-brand-lavanda/80">Como configurar:</p>
              <p>1. No Stripe → Developers → API Keys → crie uma <strong>Restricted Key</strong></p>
              <p>2. Permissões necessárias: <strong>Customers (read)</strong> e <strong>Subscriptions (read)</strong></p>
              <p>3. Para o webhook: Developers → Webhooks → Add endpoint</p>
              <p>4. Eventos: <code>customer.subscription.*</code> e <code>invoice.payment_*</code></p>
            </div>

            <div className="space-y-2">
              <Label>Stripe Restricted Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder="rk_live_..."
                  value={stripeForm.stripe_secret_key}
                  onChange={e => setStripeForm(f => ({ ...f, stripe_secret_key: e.target.value }))}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-lavanda/40 hover:text-brand-lavanda/70"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/api/stripe/webhook/${id}` : ''}
                  className="text-xs text-brand-lavanda/50 cursor-default"
                />
                <Button variant="outline" size="icon" onClick={handleCopyWebhook} className="shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5 text-brand-lima" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-brand-lavanda/40">Cole esta URL no campo "Endpoint URL" ao criar o webhook no Stripe</p>
            </div>

            <div className="space-y-2">
              <Label>Webhook Signing Secret</Label>
              <Input
                type="password"
                placeholder="whsec_..."
                value={stripeForm.stripe_webhook_secret}
                onChange={e => setStripeForm(f => ({ ...f, stripe_webhook_secret: e.target.value }))}
              />
              <p className="text-xs text-brand-lavanda/40">Encontrado em Stripe → Webhooks → seu endpoint → Signing secret</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setStripeOpen(false)}>Cancelar</Button>
              <Button onClick={handleSalvarStripe}>Salvar configuração</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

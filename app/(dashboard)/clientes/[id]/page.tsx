'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Phone, Building2, MapPin, Edit, Plus, MessageCircle, Video, PhoneCall, FileText, StickyNote,
  FolderOpen, Copy, RefreshCw, Check, FileSignature, DollarSign, UserPlus, Globe, CheckCircle2, Send, CalendarClock,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { NovaInteracaoDialog, type Interacao } from '@/components/clientes/nova-interacao-dialog'
import { labelOrigem, labelSegmento } from '@/lib/crm/opcoes'
import { formatDate, formatCurrency, formatRelative, getInitials, cn, whatsappUrl, toISODateLocal } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type ClienteRow = Database['public']['Tables']['clientes']['Row']
type Cliente = ClienteRow & { produto: { id: string; nome: string; cor: string } | null; responsavel: { nome: string } | null }
type Projeto = { id: string; nome: string; status: string; tipo: string | null; valor: number | null; data_entrega: string | null; data_conclusao: string | null; created_at: string }
type Lancamento = { id: string; descricao: string; valor: number; tipo: string; status: string; data: string }
type Proposta = { id: string; numero: string; titulo: string; status: string; valor_final: number; validade: string | null; created_at: string; enviada_em: string | null; aprovada_em: string | null }
type Contrato = { id: string; numero: string; titulo: string; status: string; valor_total: number; data_inicio: string | null; data_fim: string | null; assinado_em: string | null; created_at: string }

type EventoTimeline = { data: string; titulo: string; detalhe?: string; icon: React.FC<{ className?: string }>; cor: string; href?: string }

const tipoLabel: Record<string, string> = { agencia: 'Agência', saas: 'SaaS', ambos: 'Agência + SaaS' }

const tipoIcons: Record<string, React.FC<{ className?: string }>> = {
  reuniao: Video, whatsapp: MessageCircle, ligacao: PhoneCall, email: Mail, nota: StickyNote, outro: FileText,
}

const statusVariant: Record<string, 'ativo' | 'inativo' | 'lead' | 'default'> = {
  ativo: 'ativo', inativo: 'inativo', lead: 'lead', prospecto: 'lead',
}
const statusClienteLabel: Record<string, string> = { ativo: 'Ativo', inativo: 'Inativo', lead: 'Lead', prospecto: 'Prospecto' }

const propostaStatus: Record<string, { label: string; variant: 'outline' | 'default' | 'pendente' | 'aprovada' | 'recusada' | 'inativo' }> = {
  rascunho: { label: 'Rascunho', variant: 'outline' },
  enviada: { label: 'Enviada', variant: 'default' },
  em_negociacao: { label: 'Em Negociação', variant: 'pendente' },
  aprovada: { label: 'Aprovada', variant: 'aprovada' },
  recusada: { label: 'Recusada', variant: 'recusada' },
  expirada: { label: 'Expirada', variant: 'inativo' },
}
const contratoStatus: Record<string, { label: string; variant: 'outline' | 'default' | 'aprovada' | 'recusada' | 'inativo' }> = {
  rascunho: { label: 'Rascunho', variant: 'outline' },
  enviado: { label: 'Enviado', variant: 'default' },
  assinado: { label: 'Assinado', variant: 'aprovada' },
  encerrado: { label: 'Encerrado', variant: 'inativo' },
  cancelado: { label: 'Cancelado', variant: 'recusada' },
}
const projetoStatusLabel: Record<string, string> = {
  backlog: 'Backlog', em_andamento: 'Em andamento', aguardando_cliente: 'Aguardando cliente',
  em_revisao: 'Em revisão', concluido: 'Concluído', cancelado: 'Cancelado',
}

function EmptyState({ texto, children }: { texto: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-10">
      <p className="text-brand-lavanda/40 text-sm">{texto}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [interacaoOpen, setInteracaoOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient() as any
    async function load() {
      const [{ data: c }, { data: p }, { data: i }, { data: l }, { data: pr }, { data: ct }] = await Promise.all([
        supabase.from('clientes').select('*, produto:produtos(id,nome,cor), responsavel:profiles!clientes_responsavel_id_fkey(nome)').eq('id', id).single(),
        supabase.from('projetos').select('id, nome, status, tipo, valor, data_entrega, data_conclusao, created_at').eq('cliente_id', id).order('created_at', { ascending: false }),
        supabase.from('interacoes').select('id, tipo, titulo, descricao, data, proximo_contato').eq('cliente_id', id).order('data', { ascending: false }),
        supabase.from('lancamentos').select('id, descricao, valor, tipo, status, data').eq('cliente_id', id).order('data', { ascending: false }),
        supabase.from('propostas').select('id, numero, titulo, status, valor_final, validade, created_at, enviada_em, aprovada_em').eq('cliente_id', id).order('created_at', { ascending: false }),
        supabase.from('contratos').select('id, numero, titulo, status, valor_total, data_inicio, data_fim, assinado_em, created_at').eq('cliente_id', id).order('created_at', { ascending: false }),
      ])
      // Se a FK do responsável tiver outro nome no banco, tenta de novo sem o join.
      let clienteData = c
      if (!clienteData) {
        const { data: c2 } = await supabase.from('clientes').select('*, produto:produtos(id,nome,cor)').eq('id', id).single()
        clienteData = c2 ? { ...c2, responsavel: null } : null
      }
      setCliente(clienteData)
      setProjetos(p ?? [])
      setInteracoes(i ?? [])
      setLancamentos(l ?? [])
      setPropostas(pr ?? [])
      setContratos(ct ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function handleCopyPortalLink() {
    if (!cliente) return
    await navigator.clipboard.writeText(`${window.location.origin}/portal/${cliente.portal_token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRotatePortalToken() {
    setRotating(true)
    const supabase = createClient()
    const { data } = await (supabase as any)
      .from('clientes')
      .update({ portal_token: crypto.randomUUID(), portal_token_created_at: new Date().toISOString(), portal_ativo: true })
      .eq('id', id)
      .select('portal_token, portal_ativo, portal_token_created_at')
      .single()
    if (data) setCliente((prev) => (prev ? { ...prev, ...data } : prev))
    setRotating(false)
  }

  async function handleTogglePortalAtivo() {
    if (!cliente) return
    const novoValor = !cliente.portal_ativo
    const supabase = createClient()
    const { error } = await (supabase as any).from('clientes').update({ portal_ativo: novoValor }).eq('id', id)
    if (!error) setCliente((prev) => (prev ? { ...prev, portal_ativo: novoValor } : prev))
  }

  if (loading) return <div className="p-6 text-brand-lavanda/40 text-sm">Carregando...</div>
  if (!cliente) return (
    <div className="p-6">
      <Link href="/clientes"><Button variant="outline" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button></Link>
      <p className="mt-6 text-brand-lavanda/50">Cliente não encontrado.</p>
    </div>
  )

  // ── Métricas ────────────────────────────────────────────────────────────
  const hoje = toISODateLocal(new Date())
  const receitas = lancamentos.filter((l) => l.tipo === 'receita' && l.status !== 'cancelado')
  const ltv = receitas.filter((l) => l.status === 'recebido').reduce((s, l) => s + Number(l.valor), 0)
  const pendentes = receitas.filter((l) => l.status === 'pendente')
  const emAtraso = pendentes.filter((l) => l.data < hoje).reduce((s, l) => s + Number(l.valor), 0)
  const aReceber = pendentes.filter((l) => l.data >= hoje).reduce((s, l) => s + Number(l.valor), 0)
  const contratosValidos = contratos.filter((c) => c.status !== 'cancelado' && c.status !== 'rascunho')
  const baseTicket = contratosValidos.length > 0
    ? contratosValidos.map((c) => Number(c.valor_total))
    : projetos.filter((p) => p.valor && p.status !== 'cancelado').map((p) => Number(p.valor))
  const ticketMedio = baseTicket.length > 0 ? baseTicket.reduce((s, v) => s + v, 0) / baseTicket.length : 0
  const mesesRelacionamento = Math.max(1, Math.round((Date.now() - new Date(cliente.created_at).getTime()) / (30.44 * 86400000)))

  const projetosAtivos = projetos.filter((p) => p.status !== 'concluido' && p.status !== 'cancelado').length
  const ultimaInteracao = interacoes[0] ?? null
  const proximoContato = interacoes
    .map((i) => i.proximo_contato)
    .filter((d): d is string => !!d)
    .sort()
    .find((d) => d.slice(0, 10) >= hoje) ?? null
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal/${cliente.portal_token}` : ''
  const waUrl = whatsappUrl(cliente.whatsapp || cliente.telefone, `Olá ${cliente.nome.split(' ')[0]}!`)

  // ── Timeline unificada ──────────────────────────────────────────────────
  const timeline: EventoTimeline[] = [
    { data: cliente.created_at, titulo: 'Cliente cadastrado', detalhe: cliente.origem ? `Origem: ${labelOrigem(cliente.origem)}` : undefined, icon: UserPlus, cor: 'text-brand-lavanda/60' },
    ...interacoes.map((i) => ({
      data: i.data, titulo: i.titulo, detalhe: i.descricao ?? undefined, icon: tipoIcons[i.tipo] || FileText, cor: 'text-brand-violeta',
    })),
    ...propostas.flatMap((p) => [
      { data: p.created_at, titulo: `Proposta ${p.numero} criada`, detalhe: `${p.titulo} · ${formatCurrency(p.valor_final)}`, icon: FileText, cor: 'text-brand-lavanda/60', href: `/propostas/${p.id}` },
      ...(p.enviada_em ? [{ data: p.enviada_em, titulo: `Proposta ${p.numero} enviada`, icon: Send, cor: 'text-brand-violeta', href: `/propostas/${p.id}` }] : []),
      ...(p.aprovada_em ? [{ data: p.aprovada_em, titulo: `Proposta ${p.numero} aprovada`, detalhe: formatCurrency(p.valor_final), icon: CheckCircle2, cor: 'text-brand-lima', href: `/propostas/${p.id}` }] : []),
    ]),
    ...contratos.flatMap((c) => [
      { data: c.created_at, titulo: `Contrato ${c.numero} criado`, detalhe: c.titulo, icon: FileSignature, cor: 'text-brand-lavanda/60', href: `/contratos/${c.id}` },
      ...(c.assinado_em ? [{ data: c.assinado_em, titulo: `Contrato ${c.numero} assinado`, detalhe: formatCurrency(c.valor_total), icon: FileSignature, cor: 'text-brand-lima', href: `/contratos/${c.id}` }] : []),
    ]),
    ...projetos.flatMap((p) => [
      { data: p.created_at, titulo: `Projeto iniciado: ${p.nome}`, icon: FolderOpen, cor: 'text-brand-violeta', href: `/projetos/${p.id}` },
      ...(p.data_conclusao ? [{ data: p.data_conclusao, titulo: `Projeto concluído: ${p.nome}`, icon: CheckCircle2, cor: 'text-brand-lima', href: `/projetos/${p.id}` }] : []),
    ]),
    ...receitas.filter((l) => l.status === 'recebido').map((l) => ({
      data: l.data, titulo: `Pagamento recebido: ${formatCurrency(Number(l.valor))}`, detalhe: l.descricao, icon: DollarSign, cor: 'text-brand-lima',
    })),
    ...(cliente.portal_last_accessed_at ? [{ data: cliente.portal_last_accessed_at, titulo: 'Acessou o portal do cliente', icon: Globe, cor: 'text-brand-lavanda/60' }] : []),
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

  return (
    <div>
      <Header title="Detalhe do Cliente" />
      <div className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <Link href="/clientes">
            <Button variant="outline" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </Link>
          <Link href={`/clientes/${id}/editar`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Edit className="h-4 w-4" /> Editar
            </Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl">{getInitials(cliente.nome)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {cliente.nome}
                  </h2>
                  <Badge variant={statusVariant[cliente.status] || 'default'}>
                    {statusClienteLabel[cliente.status] ?? cliente.status}
                  </Badge>
                  {cliente.produto ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full border font-medium"
                      style={{ background: `${cliente.produto.cor}18`, borderColor: `${cliente.produto.cor}40`, color: cliente.produto.cor }}
                    >
                      {cliente.produto.nome}
                    </span>
                  ) : cliente.tipo && cliente.tipo !== 'agencia' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-brand-lavanda/60">
                      {tipoLabel[cliente.tipo]}
                    </span>
                  ) : null}
                </div>
                {cliente.empresa && <p className="text-brand-lavanda/60 mt-0.5">{cliente.empresa}</p>}
                <div className="mt-3 flex flex-wrap gap-1">
                  {(cliente.tags ?? []).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-brand-lavanda/70">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end sm:max-w-sm">
                {waUrl && (
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <a href={waUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
                  </Button>
                )}
                {cliente.email && (
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <a href={`mailto:${cliente.email}`}><Mail className="h-4 w-4" /> E-mail</a>
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setInteracaoOpen(true)}>
                  <Plus className="h-4 w-4" /> Interação
                </Button>
                <Link href={`/projetos/novo?cliente=${id}`}>
                  <Button size="sm" className="gap-2">
                    <FolderOpen className="h-4 w-4" /> Novo Projeto
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-white/[0.06] grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-brand-lavanda/40">Projetos ativos</p>
                <p className="text-lg font-semibold text-brand-lavanda mt-0.5">{projetosAtivos}</p>
              </div>
              <div>
                <p className="text-xs text-brand-lavanda/40">Total faturado (LTV)</p>
                <p className="text-lg font-semibold text-brand-lima mt-0.5">{formatCurrency(ltv)}</p>
              </div>
              <div>
                <p className="text-xs text-brand-lavanda/40">Última interação</p>
                <p className="text-sm font-medium text-brand-lavanda mt-1.5 truncate">
                  {ultimaInteracao ? formatRelative(ultimaInteracao.data) : 'Nenhuma ainda'}
                </p>
              </div>
              <div>
                <p className="text-xs text-brand-lavanda/40">Próximo contato</p>
                <p className={cn('text-sm font-medium mt-1.5', proximoContato ? 'text-brand-lavanda' : 'text-brand-lavanda/40')}>
                  {proximoContato ? formatDate(proximoContato) : 'Não agendado'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="visao-geral">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="projetos">Projetos ({projetos.length})</TabsTrigger>
            <TabsTrigger value="propostas">Propostas ({propostas.length})</TabsTrigger>
            <TabsTrigger value="contratos">Contratos ({contratos.length})</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="interacoes">Interações ({interacoes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm">Contato</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {cliente.email && (
                    <a href={`mailto:${cliente.email}`} className="flex items-center gap-3 text-sm hover:text-brand-lima transition-colors">
                      <Mail className="h-4 w-4 text-brand-violeta shrink-0" />
                      <span className="text-brand-lavanda">{cliente.email}</span>
                    </a>
                  )}
                  {cliente.whatsapp && waUrl && (
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm">
                      <MessageCircle className="h-4 w-4 text-brand-violeta shrink-0" />
                      <span className="text-brand-lavanda">{cliente.whatsapp}</span>
                    </a>
                  )}
                  {cliente.telefone && (
                    <a href={`tel:${cliente.telefone.replace(/\D/g, '')}`} className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-brand-violeta shrink-0" />
                      <span className="text-brand-lavanda">{cliente.telefone}</span>
                    </a>
                  )}
                  {cliente.empresa && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 className="h-4 w-4 text-brand-violeta shrink-0" />
                      <span className="text-brand-lavanda">{cliente.empresa}</span>
                    </div>
                  )}
                  {cliente.endereco && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-brand-violeta shrink-0" />
                      <span className="text-brand-lavanda">{cliente.endereco}{cliente.cidade ? `, ${cliente.cidade}` : ''}{cliente.estado ? ` - ${cliente.estado}` : ''}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    { label: 'Grupo', value: tipoLabel[cliente.tipo] || 'Agência' },
                    ...(cliente.produto ? [{ label: 'Produto', value: cliente.produto.nome }] : []),
                    ...(cliente.segmento ? [{ label: 'Segmento', value: labelSegmento(cliente.segmento) }] : []),
                    ...(cliente.origem ? [{ label: 'Origem', value: labelOrigem(cliente.origem) }] : []),
                    ...(cliente.responsavel?.nome ? [{ label: 'Responsável', value: cliente.responsavel.nome }] : []),
                    ...(cliente.cpf_cnpj ? [{ label: 'CPF/CNPJ', value: cliente.cpf_cnpj }] : []),
                    { label: 'Cliente desde', value: `${formatDate(cliente.created_at)} (${mesesRelacionamento} ${mesesRelacionamento === 1 ? 'mês' : 'meses'})` },
                  ].map((row, idx, arr) => (
                    <div key={row.label}>
                      <div className="flex justify-between gap-4">
                        <span className="text-brand-lavanda/50">{row.label}</span>
                        <span className="text-brand-lavanda text-right">{row.value}</span>
                      </div>
                      {idx < arr.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-sm">Portal do Cliente</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant={cliente.portal_ativo ? 'ativo' : 'inativo'}>
                      {cliente.portal_ativo ? 'Ativo' : 'Desativado'}
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={handleCopyPortalLink} disabled={!cliente.portal_ativo}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copiado' : 'Copiar link'}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-2" onClick={handleRotatePortalToken} disabled={rotating}>
                        <RefreshCw className={cn('h-4 w-4', rotating && 'animate-spin')} />
                        Gerar novo link
                      </Button>
                      <Button size="sm" variant={cliente.portal_ativo ? 'destructive' : 'default'} onClick={handleTogglePortalAtivo}>
                        {cliente.portal_ativo ? 'Revogar acesso' : 'Reativar acesso'}
                      </Button>
                    </div>
                  </div>
                  {cliente.portal_ativo && (
                    <p className="text-xs text-brand-lavanda/40 font-mono break-all">{portalUrl}</p>
                  )}
                  {cliente.portal_last_accessed_at && (
                    <p className="text-xs text-brand-lavanda/40">Último acesso: {formatDate(cliente.portal_last_accessed_at, 'dd/MM/yyyy HH:mm')}</p>
                  )}
                </CardContent>
              </Card>

              {cliente.observacoes && (
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-brand-lavanda/80 whitespace-pre-wrap">{cliente.observacoes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardContent className="p-6">
                {timeline.length === 0 ? (
                  <EmptyState texto="Nada aconteceu com este cliente ainda." />
                ) : (
                  <ol className="relative border-l border-white/[0.08] ml-3 space-y-5">
                    {timeline.map((ev, idx) => {
                      const Icon = ev.icon
                      const conteudo = (
                        <>
                          <p className="text-sm font-medium text-brand-lavanda">{ev.titulo}</p>
                          {ev.detalhe && <p className="text-xs text-brand-lavanda/50 mt-0.5 line-clamp-2">{ev.detalhe}</p>}
                          <p className="text-[11px] text-brand-lavanda/30 mt-1">{formatDate(ev.data, ev.data.length > 10 ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy')}</p>
                        </>
                      )
                      return (
                        <li key={idx} className="ml-6">
                          <span className="absolute -left-3.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-brand-noite">
                            <Icon className={cn('h-3.5 w-3.5', ev.cor)} />
                          </span>
                          {ev.href ? <Link href={ev.href} className="block hover:opacity-80">{conteudo}</Link> : conteudo}
                        </li>
                      )
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projetos">
            <div className="space-y-3">
              {projetos.length === 0 ? (
                <EmptyState texto="Nenhum projeto encontrado.">
                  <Link href={`/projetos/novo?cliente=${id}`}><Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Criar projeto</Button></Link>
                </EmptyState>
              ) : projetos.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <Link href={`/projetos/${p.id}`} className="font-medium text-brand-lavanda hover:text-brand-lima transition-colors">
                        {p.nome}
                      </Link>
                      {p.data_entrega && <p className="text-xs text-brand-lavanda/50 mt-0.5">Entrega: {formatDate(p.data_entrega)}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {p.valor != null && <span className="text-sm font-semibold text-brand-lavanda">{formatCurrency(p.valor)}</span>}
                      <Badge variant={p.status === 'concluido' ? 'concluido' : p.status === 'cancelado' ? 'inativo' : 'default'}>
                        {projetoStatusLabel[p.status] ?? p.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="propostas">
            <div className="space-y-3">
              {propostas.length === 0 ? (
                <EmptyState texto="Nenhuma proposta para este cliente.">
                  <Link href="/propostas/nova"><Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Nova proposta</Button></Link>
                </EmptyState>
              ) : propostas.map((p) => {
                const sc = propostaStatus[p.status]
                return (
                  <Card key={p.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Link href={`/propostas/${p.id}`} className="font-medium text-brand-lavanda hover:text-brand-lima transition-colors">
                          <span className="font-mono text-xs text-brand-lavanda/50 mr-2">{p.numero}</span>{p.titulo}
                        </Link>
                        <p className="text-xs text-brand-lavanda/50 mt-0.5">
                          Criada {formatDate(p.created_at)}
                          {p.validade && ` · válida até ${formatDate(p.validade)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-brand-lavanda">{formatCurrency(p.valor_final)}</span>
                        {sc && <Badge variant={sc.variant}>{sc.label}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="contratos">
            <div className="space-y-3">
              {contratos.length === 0 ? (
                <EmptyState texto="Nenhum contrato para este cliente." />
              ) : contratos.map((c) => {
                const sc = contratoStatus[c.status]
                return (
                  <Card key={c.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Link href={`/contratos/${c.id}`} className="font-medium text-brand-lavanda hover:text-brand-lima transition-colors">
                          <span className="font-mono text-xs text-brand-lavanda/50 mr-2">{c.numero}</span>{c.titulo}
                        </Link>
                        <p className="text-xs text-brand-lavanda/50 mt-0.5">
                          {c.data_inicio ? formatDate(c.data_inicio) : '—'} → {c.data_fim ? formatDate(c.data_fim) : 'vigente'}
                          {c.assinado_em && ` · assinado em ${formatDate(c.assinado_em)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-brand-lavanda">{formatCurrency(c.valor_total)}</span>
                        {sc && <Badge variant={sc.variant}>{sc.label}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="financeiro">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
              {[
                { label: 'LTV (total recebido)', valor: formatCurrency(ltv), sub: `${formatCurrency(ltv / mesesRelacionamento)}/mês em média`, cor: 'text-brand-lima' },
                { label: 'Ticket médio', valor: formatCurrency(ticketMedio), sub: contratosValidos.length > 0 ? `${contratosValidos.length} contrato(s)` : `${baseTicket.length} projeto(s)`, cor: 'text-brand-lavanda' },
                { label: 'A receber', valor: formatCurrency(aReceber), sub: `${pendentes.filter((l) => l.data >= hoje).length} lançamento(s)`, cor: 'text-brand-lavanda' },
                { label: 'Em atraso', valor: formatCurrency(emAtraso), sub: `${pendentes.filter((l) => l.data < hoje).length} lançamento(s)`, cor: emAtraso > 0 ? 'text-brand-rosa' : 'text-brand-lavanda/50' },
              ].map((k) => (
                <Card key={k.label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-brand-lavanda/50">{k.label}</p>
                    <p className={cn('text-xl font-bold mt-1', k.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>{k.valor}</p>
                    <p className="text-[11px] text-brand-lavanda/40 mt-0.5">{k.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-0">
                {lancamentos.length === 0 ? (
                  <EmptyState texto="Nenhum lançamento vinculado a este cliente." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Data</th>
                          <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Descrição</th>
                          <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Status</th>
                          <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lancamentos.map((l) => {
                          const atrasado = l.status === 'pendente' && l.data < hoje
                          return (
                            <tr key={l.id} className="border-b border-white/[0.04]">
                              <td className="px-4 py-2.5 text-xs text-brand-lavanda/60 whitespace-nowrap">{formatDate(l.data)}</td>
                              <td className="px-4 py-2.5 text-brand-lavanda">{l.descricao}</td>
                              <td className="px-4 py-2.5">
                                <Badge variant={atrasado ? 'urgente' : l.status === 'recebido' || l.status === 'pago' ? 'ativo' : l.status === 'cancelado' ? 'inativo' : 'pendente'}>
                                  {atrasado ? 'Atrasado' : l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                                </Badge>
                              </td>
                              <td className={cn('px-4 py-2.5 text-right font-medium whitespace-nowrap', l.tipo === 'receita' ? 'text-brand-lima' : 'text-brand-rosa')}>
                                {l.tipo === 'receita' ? '+' : '−'}{formatCurrency(Number(l.valor))}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interacoes">
            <div className="space-y-3">
              <div className="flex justify-end mb-2">
                <Button size="sm" className="gap-2" onClick={() => setInteracaoOpen(true)}>
                  <Plus className="h-4 w-4" /> Nova Interação
                </Button>
              </div>
              {interacoes.length === 0 ? (
                <EmptyState texto="Nenhuma interação registrada." />
              ) : interacoes.map((i) => {
                const Icon = tipoIcons[i.tipo] || FileText
                return (
                  <Card key={i.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06]">
                          <Icon className="h-4 w-4 text-brand-violeta" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-brand-lavanda text-sm">{i.titulo}</p>
                            <span className="text-xs text-brand-lavanda/40">{formatDate(i.data, 'dd/MM/yyyy HH:mm')}</span>
                          </div>
                          {i.descricao && <p className="text-xs text-brand-lavanda/60 mt-1">{i.descricao}</p>}
                          {i.proximo_contato && (
                            <p className="text-[11px] text-brand-violeta mt-1.5 flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" /> Próximo contato: {formatDate(i.proximo_contato)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <NovaInteracaoDialog
        clienteId={id}
        clienteNome={cliente.nome}
        open={interacaoOpen}
        onOpenChange={setInteracaoOpen}
        onCreated={(nova) => setInteracoes((prev) => [nova, ...prev].sort((a, b) => b.data.localeCompare(a.data)))}
      />
    </div>
  )
}

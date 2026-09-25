'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Plus, Search, Building2, Mail, Phone, MoreHorizontal, Users, LayoutGrid, List, Download, Upload,
  ArrowUpDown, ArrowUp, ArrowDown, MessageCircle, CalendarClock, X,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { NovaInteracaoDialog } from '@/components/clientes/nova-interacao-dialog'
import { ImportarClientesDialog } from '@/components/clientes/importar-clientes-dialog'
import { getInitials, formatDate, formatCurrency, formatRelative, whatsappUrl, toISODateLocal, cn } from '@/lib/utils'
import { labelOrigem, labelSegmento } from '@/lib/crm/opcoes'
import { toCSV, downloadCSV } from '@/lib/csv'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Cliente = Database['public']['Tables']['clientes']['Row']
type Produto = { id: string; nome: string; cor: string }
type Responsavel = { id: string; nome: string }
type Ordenacao = 'recentes' | 'nome' | 'faturado' | 'ultima_interacao' | 'proximo_contato'
type Visao = 'cards' | 'tabela'

const statusVariantMap: Record<string, 'ativo' | 'inativo' | 'lead' | 'default'> = {
  ativo: 'ativo', inativo: 'inativo', lead: 'lead', prospecto: 'lead',
}
const statusLabel: Record<string, string> = {
  ativo: 'Ativo', inativo: 'Inativo', lead: 'Lead', prospecto: 'Prospecto',
}
const grupoLabel: Record<string, string> = {
  todos: 'Todos', agencia: 'Agência', saas: 'SaaS',
}
const ordenacaoLabel: Record<Ordenacao, string> = {
  recentes: 'Mais recentes', nome: 'Nome (A–Z)', faturado: 'Maior faturamento',
  ultima_interacao: 'Sem contato há mais tempo', proximo_contato: 'Próximo contato',
}

const VISAO_KEY = 'trasso:clientes:visao'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [faturadoPorCliente, setFaturadoPorCliente] = useState<Record<string, number>>({})
  const [projetosAtivosPorCliente, setProjetosAtivosPorCliente] = useState<Record<string, number>>({})
  const [ultimaInteracaoPorCliente, setUltimaInteracaoPorCliente] = useState<Record<string, string>>({})
  const [proximoContatoPorCliente, setProximoContatoPorCliente] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [recarregar, setRecarregar] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [grupoFilter, setGrupoFilter] = useState('todos')
  const [produtoFilter, setProdutoFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('todos')
  const [origemFilter, setOrigemFilter] = useState('todos')
  const [segmentoFilter, setSegmentoFilter] = useState('todos')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('recentes')
  const [ordemInvertida, setOrdemInvertida] = useState(false)
  const [visao, setVisao] = useState<Visao>('cards')
  const [interacaoCliente, setInteracaoCliente] = useState<Cliente | null>(null)
  const [importarOpen, setImportarOpen] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(VISAO_KEY)
      if (salvo === 'cards' || salvo === 'tabela') setVisao(salvo)
    } catch {}
  }, [])

  function mudarVisao(v: Visao) {
    setVisao(v)
    try { localStorage.setItem(VISAO_KEY, v) } catch {}
  }

  useEffect(() => {
    const supabase = createClient() as any
    async function load() {
      const [{ data: c }, { data: p }, { data: lanc }, { data: proj }, { data: inter }, { data: resp }] = await Promise.all([
        supabase.from('clientes').select('*').order('created_at', { ascending: false }),
        supabase.from('produtos').select('id, nome, cor').eq('tipo', 'saas').eq('ativo', true),
        supabase.from('lancamentos').select('cliente_id, valor').eq('tipo', 'receita').eq('status', 'recebido').not('cliente_id', 'is', null),
        supabase.from('projetos').select('cliente_id, status').not('cliente_id', 'is', null),
        supabase.from('interacoes').select('cliente_id, data, proximo_contato'),
        supabase.from('profiles').select('id, nome').order('nome'),
      ])
      setClientes(c ?? [])
      setProdutos(p ?? [])
      setResponsaveis(resp ?? [])

      const faturado: Record<string, number> = {}
      for (const l of lanc ?? []) faturado[l.cliente_id] = (faturado[l.cliente_id] ?? 0) + Number(l.valor)
      setFaturadoPorCliente(faturado)

      const ativos: Record<string, number> = {}
      for (const pr of proj ?? []) {
        if (pr.status === 'concluido' || pr.status === 'cancelado') continue
        ativos[pr.cliente_id] = (ativos[pr.cliente_id] ?? 0) + 1
      }
      setProjetosAtivosPorCliente(ativos)

      const interacoes = (inter ?? []) as { cliente_id: string; data: string; proximo_contato: string | null }[]
      const ultima: Record<string, string> = {}
      for (const i of interacoes) {
        if (!ultima[i.cliente_id] || i.data > ultima[i.cliente_id]) ultima[i.cliente_id] = i.data
      }
      // Follow-up pendente = agendado para depois do último contato registrado. Fica o mais antigo.
      const proximo: Record<string, string> = {}
      for (const i of interacoes) {
        if (!i.proximo_contato) continue
        if (ultima[i.cliente_id].slice(0, 10) >= i.proximo_contato.slice(0, 10)) continue
        if (!proximo[i.cliente_id] || i.proximo_contato < proximo[i.cliente_id]) proximo[i.cliente_id] = i.proximo_contato
      }
      setUltimaInteracaoPorCliente(ultima)
      setProximoContatoPorCliente(proximo)

      setLoading(false)
    }
    load()
  }, [recarregar])

  const produtoMap = Object.fromEntries(produtos.map((p) => [p.id, p]))
  const responsavelMap = Object.fromEntries(responsaveis.map((r) => [r.id, r.nome]))
  const origensDisponiveis = [...new Set(clientes.map((c) => c.origem).filter((o): o is string => !!o))].sort()
  const segmentosDisponiveis = [...new Set(clientes.map((c) => c.segmento).filter((s): s is string => !!s))].sort()
  const hoje = toISODateLocal(new Date())

  const filtered = useMemo(() => {
    const termo = search.toLowerCase()
    const lista = clientes.filter((c) => {
      const matchSearch = !termo ||
        c.nome.toLowerCase().includes(termo) ||
        c.email?.toLowerCase().includes(termo) ||
        c.empresa?.toLowerCase().includes(termo) ||
        c.telefone?.includes(termo) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(termo))
      const matchStatus = statusFilter === 'todos' || c.status === statusFilter
      const matchGrupo =
        grupoFilter === 'todos' ||
        (grupoFilter === 'agencia' && (c.tipo === 'agencia' || c.tipo === 'ambos')) ||
        (grupoFilter === 'saas' && (c.tipo === 'saas' || c.tipo === 'ambos'))
      const matchProduto = !produtoFilter || c.produto_id === produtoFilter
      const matchResp = responsavelFilter === 'todos' || (responsavelFilter === 'nenhum' ? !c.responsavel_id : c.responsavel_id === responsavelFilter)
      const matchOrigem = origemFilter === 'todos' || c.origem === origemFilter
      const matchSegmento = segmentoFilter === 'todos' || c.segmento === segmentoFilter
      return matchSearch && matchStatus && matchGrupo && matchProduto && matchResp && matchOrigem && matchSegmento
    })

    const cmp: Record<Ordenacao, (a: Cliente, b: Cliente) => number> = {
      recentes: (a, b) => b.created_at.localeCompare(a.created_at),
      nome: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
      faturado: (a, b) => (faturadoPorCliente[b.id] ?? 0) - (faturadoPorCliente[a.id] ?? 0),
      // Nunca contatados primeiro, depois o contato mais antigo.
      ultima_interacao: (a, b) => (ultimaInteracaoPorCliente[a.id] ?? '').localeCompare(ultimaInteracaoPorCliente[b.id] ?? ''),
      // Sem follow-up vão para o fim.
      proximo_contato: (a, b) => (proximoContatoPorCliente[a.id] ?? '9999').localeCompare(proximoContatoPorCliente[b.id] ?? '9999'),
    }
    const ordenada = [...lista].sort(cmp[ordenacao])
    return ordemInvertida ? ordenada.reverse() : ordenada
  }, [clientes, search, statusFilter, grupoFilter, produtoFilter, responsavelFilter, origemFilter, segmentoFilter, ordenacao, ordemInvertida, faturadoPorCliente, ultimaInteracaoPorCliente, proximoContatoPorCliente])

  const showSaasSubfilter = grupoFilter === 'saas' && produtos.length > 0
  const filtrosExtrasAtivos = responsavelFilter !== 'todos' || origemFilter !== 'todos' || segmentoFilter !== 'todos'
  const followUpsAtrasados = Object.values(proximoContatoPorCliente).filter((d) => d.slice(0, 10) < hoje).length

  function limparFiltros() {
    setSearch(''); setStatusFilter('todos'); setGrupoFilter('todos'); setProdutoFilter('')
    setResponsavelFilter('todos'); setOrigemFilter('todos'); setSegmentoFilter('todos')
  }

  function ordenarPor(o: Ordenacao) {
    if (ordenacao === o) setOrdemInvertida((v) => !v)
    else { setOrdenacao(o); setOrdemInvertida(false) }
  }

  function exportar() {
    const header = ['Nome', 'Empresa', 'E-mail', 'Telefone', 'WhatsApp', 'CPF/CNPJ', 'Cidade', 'Estado', 'Status', 'Grupo', 'Produto', 'Segmento', 'Origem', 'Responsável', 'Tags', 'Faturado', 'Projetos ativos', 'Última interação', 'Próximo contato', 'Cliente desde']
    const rows = filtered.map((c) => [
      c.nome, c.empresa, c.email, c.telefone, c.whatsapp, c.cpf_cnpj, c.cidade, c.estado,
      statusLabel[c.status] ?? c.status, grupoLabel[c.tipo] ?? c.tipo, c.produto_id ? produtoMap[c.produto_id]?.nome : '',
      c.segmento ? labelSegmento(c.segmento) : '', c.origem ? labelOrigem(c.origem) : '',
      c.responsavel_id ? responsavelMap[c.responsavel_id] : '', (c.tags ?? []).join(', '),
      (faturadoPorCliente[c.id] ?? 0).toFixed(2).replace('.', ','), projetosAtivosPorCliente[c.id] ?? 0,
      ultimaInteracaoPorCliente[c.id] ? formatDate(ultimaInteracaoPorCliente[c.id]) : '',
      proximoContatoPorCliente[c.id] ? formatDate(proximoContatoPorCliente[c.id]) : '',
      formatDate(c.created_at),
    ])
    downloadCSV(`clientes-${toISODateLocal(new Date())}.csv`, toCSV(header, rows))
  }

  function menuAcoes(cliente: Cliente, className?: string) {
    const wa = whatsappUrl(cliente.whatsapp || cliente.telefone)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={cn('h-8 w-8', className)} aria-label="Ações">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/clientes/${cliente.id}`}>Ver detalhes</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setInteracaoCliente(cliente)}>Nova interação</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/projetos/novo?cliente=${cliente.id}`}>Novo projeto</Link>
          </DropdownMenuItem>
          {wa && (
            <DropdownMenuItem asChild>
              <a href={wa} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function proximoContato(clienteId: string) {
    const d = proximoContatoPorCliente[clienteId]
    if (!d) return null
    const atrasado = d.slice(0, 10) < hoje
    const ehHoje = d.slice(0, 10) === hoje
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px]', atrasado ? 'text-brand-rosa' : ehHoje ? 'text-brand-lima' : 'text-brand-violeta')}>
        <CalendarClock className="h-3 w-3" />
        {atrasado ? `Follow-up atrasado (${formatDate(d)})` : ehHoje ? 'Follow-up hoje' : `Follow-up ${formatDate(d)}`}
      </span>
    )
  }

  function thOrdenavel(label: string, campo: Ordenacao, className?: string) {
    const ativo = ordenacao === campo
    const Icon = !ativo ? ArrowUpDown : ordemInvertida ? ArrowUp : ArrowDown
    return (
      <th className={cn('text-xs text-brand-lavanda/50 font-medium px-4 py-3', className)}>
        <button onClick={() => ordenarPor(campo)} className={cn('inline-flex items-center gap-1 hover:text-brand-lavanda', ativo && 'text-brand-lavanda')}>
          {label} <Icon className="h-3 w-3" />
        </button>
      </th>
    )
  }

  return (
    <div>
      <Header title="Clientes" description="Gerencie seus clientes e leads" />
      <div className="p-6">
        <PageHeader
          title="Clientes"
          description={`${filtered.length} clientes encontrados${followUpsAtrasados > 0 ? ` • ${followUpsAtrasados} follow-up(s) atrasado(s)` : ''}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/[0.1] p-0.5">
              <Button variant={visao === 'cards' ? 'violeta' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => mudarVisao('cards')} title="Cards">
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button variant={visao === 'tabela' ? 'violeta' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => mudarVisao('tabela')} title="Tabela">
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportarOpen(true)}>
              <Upload className="h-4 w-4" /> Importar
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportar} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Link href="/clientes/novo">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Novo Cliente
              </Button>
            </Link>
          </div>
        </PageHeader>

        {aviso && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-brand-lima/20 bg-brand-lima/[0.06] px-4 py-2.5 text-sm text-brand-lima">
            {aviso}
            <button onClick={() => setAviso(null)} aria-label="Fechar"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
              <Input
                placeholder="Buscar por nome, empresa, email, telefone ou tag..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={ordenacao} onValueChange={(v) => { setOrdenacao(v as Ordenacao); setOrdemInvertida(false) }}>
              <SelectTrigger className="lg:w-60"><ArrowUpDown className="h-3.5 w-3.5 mr-2 opacity-60" /><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ordenacaoLabel) as Ordenacao[]).map((o) => (
                  <SelectItem key={o} value={o}>{ordenacaoLabel[o]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['todos', 'agencia', 'saas'] as const).map((g) => (
              <Button
                key={g}
                variant={grupoFilter === g ? 'violeta' : 'outline'}
                size="sm"
                onClick={() => { setGrupoFilter(g); setProdutoFilter('') }}
              >
                {grupoLabel[g]}
              </Button>
            ))}
            <span className="mx-1 w-px bg-white/[0.08]" />
            {['todos', 'ativo', 'lead', 'prospecto', 'inativo'].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? 'violeta' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'todos' ? 'Todos os status' : statusLabel[s] || s}
              </Button>
            ))}
          </div>

          {showSaasSubfilter && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={produtoFilter === '' ? 'violeta' : 'outline'}
                size="sm"
                onClick={() => setProdutoFilter('')}
              >
                Todos os produtos
              </Button>
              {produtos.map((p) => (
                <Button
                  key={p.id}
                  variant={produtoFilter === p.id ? 'violeta' : 'outline'}
                  size="sm"
                  onClick={() => setProdutoFilter(p.id)}
                  className="gap-1.5"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.cor }} />
                  {p.nome}
                </Button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
              <SelectTrigger className="h-8 w-auto min-w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os responsáveis</SelectItem>
                <SelectItem value="nenhum">Sem responsável</SelectItem>
                {responsaveis.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={origemFilter} onValueChange={setOrigemFilter}>
              <SelectTrigger className="h-8 w-auto min-w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as origens</SelectItem>
                {origensDisponiveis.map((o) => <SelectItem key={o} value={o}>{labelOrigem(o)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={segmentoFilter} onValueChange={setSegmentoFilter}>
              <SelectTrigger className="h-8 w-auto min-w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os segmentos</SelectItem>
                {segmentosDisponiveis.map((s) => <SelectItem key={s} value={s}>{labelSegmento(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filtrosExtrasAtivos || search || statusFilter !== 'todos' || grupoFilter !== 'todos') && (
              <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1 text-xs">
                <X className="h-3.5 w-3.5" /> Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06] mb-4">
              <Users className="h-8 w-8 text-brand-violeta/50" />
            </div>
            <h3 className="text-lg font-semibold text-brand-lavanda">Nenhum cliente encontrado</h3>
            <p className="text-sm text-brand-lavanda/50 mt-1">Tente ajustar os filtros ou adicione um novo cliente.</p>
          </div>
        ) : visao === 'tabela' ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left">
                      {thOrdenavel('Cliente', 'nome', 'px-6')}
                      <th className="text-xs text-brand-lavanda/50 font-medium px-4 py-3">Status</th>
                      <th className="text-xs text-brand-lavanda/50 font-medium px-4 py-3">Origem</th>
                      <th className="text-xs text-brand-lavanda/50 font-medium px-4 py-3">Responsável</th>
                      {thOrdenavel('Faturado', 'faturado', 'text-right')}
                      {thOrdenavel('Última interação', 'ultima_interacao')}
                      {thOrdenavel('Próximo contato', 'proximo_contato')}
                      {thOrdenavel('Desde', 'recentes')}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const ultima = ultimaInteracaoPorCliente[c.id]
                      return (
                        <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-3">
                            <Link href={`/clientes/${c.id}`} className="font-medium text-brand-lavanda hover:text-brand-lima transition-colors">{c.nome}</Link>
                            {c.empresa && <p className="text-xs text-brand-lavanda/50">{c.empresa}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariantMap[c.status] || 'default'}>{statusLabel[c.status] || c.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-brand-lavanda/60 whitespace-nowrap">{c.origem ? labelOrigem(c.origem) : '—'}</td>
                          <td className="px-4 py-3 text-xs text-brand-lavanda/60 whitespace-nowrap">{c.responsavel_id ? responsavelMap[c.responsavel_id] ?? '—' : '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-brand-lima whitespace-nowrap">
                            {faturadoPorCliente[c.id] ? formatCurrency(faturadoPorCliente[c.id]) : <span className="text-brand-lavanda/30 font-normal">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-brand-lavanda/60 whitespace-nowrap">{ultima ? formatRelative(ultima) : 'Nunca'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{proximoContatoPorCliente[c.id] ? proximoContato(c.id) :<span className="text-xs text-brand-lavanda/30">—</span>}</td>
                          <td className="px-4 py-3 text-xs text-brand-lavanda/50 whitespace-nowrap">{formatDate(c.created_at, 'MMM yyyy')}</td>
                          <td className="px-4 py-3 text-right">{menuAcoes(c)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((cliente) => {
              const produto = cliente.produto_id ? produtoMap[cliente.produto_id] : null
              const faturado = faturadoPorCliente[cliente.id] ?? 0
              const projetosAtivos = projetosAtivosPorCliente[cliente.id] ?? 0
              const wa = whatsappUrl(cliente.whatsapp || cliente.telefone)
              return (
                <Card key={cliente.id} className="hover:border-white/[0.12] transition-colors group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-sm">{getInitials(cliente.nome)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link href={`/clientes/${cliente.id}`} className="font-semibold text-brand-lavanda hover:text-brand-lima transition-colors">
                            {cliente.nome}
                          </Link>
                          {cliente.empresa && <p className="text-xs text-brand-lavanda/50 truncate">{cliente.empresa}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={statusVariantMap[cliente.status] || 'default'}>
                          {statusLabel[cliente.status] || cliente.status}
                        </Badge>
                        {menuAcoes(cliente, 'opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100')}
                      </div>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      {cliente.email && (
                        <a href={`mailto:${cliente.email}`} className="flex items-center gap-2 text-xs text-brand-lavanda/60 hover:text-brand-lavanda">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{cliente.email}</span>
                        </a>
                      )}
                      {(cliente.whatsapp || cliente.telefone) && (
                        wa ? (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-brand-lavanda/60 hover:text-brand-lavanda">
                            {cliente.whatsapp ? <MessageCircle className="h-3 w-3 shrink-0" /> : <Phone className="h-3 w-3 shrink-0" />}
                            {cliente.whatsapp || cliente.telefone}
                          </a>
                        ) : null
                      )}
                      {cliente.segmento && (
                        <div className="flex items-center gap-2 text-xs text-brand-lavanda/60">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span>{labelSegmento(cliente.segmento)}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {produto && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                          style={{ background: `${produto.cor}18`, borderColor: `${produto.cor}40`, color: produto.cor }}
                        >
                          {produto.nome}
                        </span>
                      )}
                      {!produto && cliente.tipo !== 'agencia' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-brand-lavanda/50">
                          {cliente.tipo === 'saas' ? 'SaaS' : 'Agência + SaaS'}
                        </span>
                      )}
                      {(cliente.tags ?? []).map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-brand-lavanda/70">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {(faturado > 0 || projetosAtivos > 0) && (
                      <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-brand-lavanda/40">Faturado</p>
                          <p className="text-sm font-semibold text-brand-lima">{formatCurrency(faturado)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-brand-lavanda/40">Projetos ativos</p>
                          <p className="text-sm font-semibold text-brand-lavanda">{projetosAtivos}</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] text-brand-lavanda/30">
                        {ultimaInteracaoPorCliente[cliente.id]
                          ? `Último contato ${formatRelative(ultimaInteracaoPorCliente[cliente.id])}`
                          : `Cliente desde ${formatDate(cliente.created_at, 'MMM yyyy')}`}
                      </p>
                      {proximoContato(cliente.id)}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {interacaoCliente && (
        <NovaInteracaoDialog
          clienteId={interacaoCliente.id}
          clienteNome={interacaoCliente.nome}
          open={!!interacaoCliente}
          onOpenChange={(v) => { if (!v) setInteracaoCliente(null) }}
          onCreated={() => setRecarregar((n) => n + 1)}
        />
      )}
      <ImportarClientesDialog
        open={importarOpen}
        onOpenChange={setImportarOpen}
        onImported={(n) => { setAviso(`${n} cliente(s) importado(s).`); setRecarregar((x) => x + 1) }}
      />
    </div>
  )
}

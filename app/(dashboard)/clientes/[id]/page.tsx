'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, Building2, MapPin, Edit, Plus, MessageCircle, Video, PhoneCall, FileText, StickyNote, FolderOpen, Copy, RefreshCw, Check, Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatCurrency, formatRelative, getInitials, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type ClienteRow = Database['public']['Tables']['clientes']['Row']
type Cliente = ClienteRow & { produto: { id: string; nome: string; cor: string } | null }
type Projeto = { id: string; nome: string; status: string; valor: number | null; data_entrega: string | null }
type Interacao = { id: string; tipo: string; titulo: string; descricao: string | null; data: string }

const tipoLabel: Record<string, string> = { agencia: 'Agência', saas: 'SaaS', ambos: 'Agência + SaaS' }

const tipoIcons: Record<string, React.FC<any>> = {
  reuniao: Video, whatsapp: MessageCircle, ligacao: PhoneCall, email: Mail, nota: StickyNote, outro: FileText,
}

const tipoInteracaoLabel: Record<string, string> = {
  reuniao: 'Reunião', whatsapp: 'WhatsApp', ligacao: 'Ligação', email: 'E-mail', nota: 'Nota', outro: 'Outro',
}

const INTERACAO_VAZIA = { tipo: 'reuniao', titulo: '', descricao: '', data: '' }

const statusVariant: Record<string, 'ativo' | 'inativo' | 'lead' | 'default'> = {
  ativo: 'ativo', inativo: 'inativo', lead: 'lead', prospecto: 'lead',
}

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [loading, setLoading] = useState(true)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [interacaoOpen, setInteracaoOpen] = useState(false)
  const [interacaoForm, setInteracaoForm] = useState(INTERACAO_VAZIA)
  const [salvandoInteracao, setSalvandoInteracao] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: c }, { data: p }, { data: i }] = await Promise.all([
        supabase.from('clientes').select('*, produto:produtos(id,nome,cor)').eq('id', id).single(),
        supabase.from('projetos').select('id, nome, status, valor, data_entrega').eq('cliente_id', id).order('created_at', { ascending: false }),
        supabase.from('interacoes').select('id, tipo, titulo, descricao, data').eq('cliente_id', id).order('data', { ascending: false }),
      ])
      setCliente(c)
      setProjetos(p ?? [])
      setInteracoes(i ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  const totalFaturado = projetos.reduce((s, p) => s + (p.valor ?? 0), 0)
  const projetosAtivos = projetos.filter((p) => p.status !== 'concluido').length
  const ultimaInteracao = interacoes[0] ?? null
  const portalUrl = cliente && typeof window !== 'undefined' ? `${window.location.origin}/portal/${cliente.portal_token}` : ''

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

  function handleAbrirNovaInteracao() {
    setInteracaoForm({ ...INTERACAO_VAZIA, data: new Date().toISOString().slice(0, 16) })
    setInteracaoOpen(true)
  }

  async function handleCriarInteracao() {
    if (!interacaoForm.titulo.trim()) return
    setSalvandoInteracao(true)
    const supabase = createClient()
    const { data, error } = await (supabase as any)
      .from('interacoes')
      .insert({
        cliente_id: id,
        tipo: interacaoForm.tipo,
        titulo: interacaoForm.titulo.trim(),
        descricao: interacaoForm.descricao.trim() || null,
        data: interacaoForm.data ? new Date(interacaoForm.data).toISOString() : new Date().toISOString(),
      })
      .select('id, tipo, titulo, descricao, data')
      .single()
    setSalvandoInteracao(false)
    if (error || !data) return
    setInteracoes((prev) => [data as Interacao, ...prev])
    setInteracaoOpen(false)
  }

  if (loading) return <div className="p-6 text-brand-lavanda/40 text-sm">Carregando...</div>
  if (!cliente) return (
    <div className="p-6">
      <Link href="/clientes"><Button variant="outline" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button></Link>
      <p className="mt-6 text-brand-lavanda/50">Cliente não encontrado.</p>
    </div>
  )

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
                    {cliente.status}
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
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={handleAbrirNovaInteracao}>
                  <Plus className="h-4 w-4" /> Interação
                </Button>
                <Link href="/projetos/novo">
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
                <p className="text-xs text-brand-lavanda/40">Total faturado</p>
                <p className="text-lg font-semibold text-brand-lima mt-0.5">{formatCurrency(totalFaturado)}</p>
              </div>
              <div>
                <p className="text-xs text-brand-lavanda/40">Última interação</p>
                <p className="text-sm font-medium text-brand-lavanda mt-1.5 truncate">
                  {ultimaInteracao ? formatRelative(ultimaInteracao.data) : 'Nenhuma ainda'}
                </p>
              </div>
              <div>
                <p className="text-xs text-brand-lavanda/40">Cliente desde</p>
                <p className="text-sm font-medium text-brand-lavanda mt-1.5">{formatDate(cliente.created_at, 'MMM yyyy')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="visao-geral">
          <TabsList className="mb-4">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="projetos">Projetos ({projetos.length})</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="interacoes">Interações ({interacoes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm">Contato</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {cliente.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-brand-violeta shrink-0" />
                      <span className="text-brand-lavanda">{cliente.email}</span>
                    </div>
                  )}
                  {cliente.telefone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-brand-violeta shrink-0" />
                      <span className="text-brand-lavanda">{cliente.telefone}</span>
                    </div>
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
                  <div className="flex justify-between">
                    <span className="text-brand-lavanda/50">Grupo</span>
                    <span className="text-brand-lavanda">{tipoLabel[cliente.tipo] || 'Agência'}</span>
                  </div>
                  <Separator />
                  {cliente.produto && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-brand-lavanda/50">Produto</span>
                        <span className="font-medium" style={{ color: cliente.produto.cor }}>{cliente.produto.nome}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {cliente.segmento && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-brand-lavanda/50">Segmento</span>
                        <span className="text-brand-lavanda capitalize">{cliente.segmento}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {cliente.origem && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-brand-lavanda/50">Origem</span>
                        <span className="text-brand-lavanda capitalize">{cliente.origem}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {cliente.cpf_cnpj && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-brand-lavanda/50">CPF/CNPJ</span>
                        <span className="text-brand-lavanda">{cliente.cpf_cnpj}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-brand-lavanda/50">Cliente desde</span>
                    <span className="text-brand-lavanda">{formatDate(cliente.created_at)}</span>
                  </div>
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
                    <p className="text-sm text-brand-lavanda/80">{cliente.observacoes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="projetos">
            <div className="space-y-3">
              {projetos.length === 0 ? (
                <p className="text-brand-lavanda/40 text-sm text-center py-8">Nenhum projeto encontrado.</p>
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
                      <Badge variant={p.status === 'concluido' ? 'concluido' : 'default'} className="capitalize">
                        {p.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="financeiro">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card><CardContent className="p-5 text-center">
                <p className="text-xs text-brand-lavanda/50 uppercase tracking-wider">Total Faturado</p>
                <p className="text-2xl font-bold text-brand-lavanda mt-1">{formatCurrency(totalFaturado)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-5 text-center">
                <p className="text-xs text-brand-lavanda/50 uppercase tracking-wider">Projetos</p>
                <p className="text-2xl font-bold text-brand-lima mt-1">{projetos.length}</p>
              </CardContent></Card>
              <Card><CardContent className="p-5 text-center">
                <p className="text-xs text-brand-lavanda/50 uppercase tracking-wider">Interações</p>
                <p className="text-2xl font-bold text-brand-violeta mt-1">{interacoes.length}</p>
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="interacoes">
            <div className="space-y-3">
              <div className="flex justify-end mb-2">
                <Button size="sm" className="gap-2" onClick={handleAbrirNovaInteracao}>
                  <Plus className="h-4 w-4" /> Nova Interação
                </Button>
              </div>
              {interacoes.length === 0 ? (
                <p className="text-brand-lavanda/40 text-sm text-center py-8">Nenhuma interação registrada.</p>
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

      <Dialog open={interacaoOpen} onOpenChange={setInteracaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova interação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={interacaoForm.tipo} onValueChange={(v) => setInteracaoForm((f) => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoInteracaoLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interacaoTitulo">Título</Label>
              <Input
                id="interacaoTitulo"
                value={interacaoForm.titulo}
                onChange={(e) => setInteracaoForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Reunião de alinhamento"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interacaoData">Data</Label>
              <Input
                id="interacaoData"
                type="datetime-local"
                value={interacaoForm.data}
                onChange={(e) => setInteracaoForm((f) => ({ ...f, data: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interacaoDescricao">Descrição (opcional)</Label>
              <Textarea
                id="interacaoDescricao"
                value={interacaoForm.descricao}
                onChange={(e) => setInteracaoForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes da interação..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInteracaoOpen(false)} disabled={salvandoInteracao}>Cancelar</Button>
            <Button onClick={handleCriarInteracao} disabled={salvandoInteracao || !interacaoForm.titulo.trim()}>
              {salvandoInteracao ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar interação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Globe, Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EstadoVazio } from '@/components/ui/estado-vazio'
import { SkeletonLista } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { formatRelative } from '@/lib/utils'
import { SITE_SELECT, type SiteCliente } from '@/lib/sites-clientes/leads'

type Item = SiteCliente & {
  clientes: { nome: string; empresa: string | null } | null
  total: { count: number }[]
  novos: { count: number }[]
}
type ClienteOpcao = { id: string; nome: string; empresa: string | null }

export default function SitesClientesPage() {
  const router = useRouter()
  const [itens, setItens] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await (createClient() as any)
        .from('sites_clientes')
        .select(`${SITE_SELECT}, clientes(nome, empresa), total:site_leads(count), novos:site_leads(count)`)
        .eq('novos.status', 'novo')
        .order('created_at', { ascending: false })
      if (error) setErro('Não foi possível carregar. A migration 20261110000000_sites_clientes.sql já foi aplicada no Supabase?')
      setItens((data as Item[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Sites" description="Sites entregues aos clientes" />

      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="Sites dos clientes" description="Cada site recebe uma chave para enviar os leads. O cliente vê os leads dele no portal.">
          <Button onClick={() => setAberto(true)}>
            <Plus className="h-4 w-4" /> Novo site
          </Button>
        </PageHeader>
        {erro && <p className="mb-4 text-xs text-brand-rosa">{erro}</p>}

        {loading ? (
          <SkeletonLista />
        ) : itens.length === 0 ? (
          <Card>
            <EstadoVazio
              icone={Globe}
              titulo="Nenhum site cadastrado"
              texto="Cadastre o site de um cliente para gerar a chave de leads e liberar a aba “Meu site” no portal dele."
              acao={{ label: 'Novo site', onClick: () => setAberto(true), icon: Plus }}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {itens.map((s) => {
              const novos = s.novos?.[0]?.count ?? 0
              return (
                <Link key={s.id} href={`/sites-clientes/${s.id}`}>
                  <Card className="h-full transition-colors hover:border-brand-lima/40">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-brand-lavanda">{s.nome}</p>
                        <Badge variant={s.ativo ? 'ativo' : 'inativo'}>{s.ativo ? 'No ar' : 'Desativado'}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-brand-lavanda/50">
                        {s.clientes?.empresa || s.clientes?.nome || 'Cliente'}
                        {s.dominio && <span className="font-mono text-brand-lavanda/40"> · {s.dominio}</span>}
                      </p>
                      <div className="mt-4 flex items-center gap-4 text-xs text-brand-lavanda/60">
                        <span>{s.total?.[0]?.count ?? 0} leads</span>
                        {novos > 0 && <span className="text-brand-lima">{novos} novos</span>}
                        {!s.chave_prefixo && <span className="text-yellow-400">sem chave</span>}
                        <span className="ml-auto text-brand-lavanda/40">criado {formatRelative(s.created_at)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      <NovoSiteDialog open={aberto} onOpenChange={setAberto} onCriado={(id) => router.push(`/sites-clientes/${id}`)} />
    </div>
  )
}

function NovoSiteDialog({ open, onOpenChange, onCriado }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCriado: (id: string) => void
}) {
  const [clientes, setClientes] = useState<ClienteOpcao[]>([])
  const [clienteId, setClienteId] = useState('')
  const [nome, setNome] = useState('')
  const [dominio, setDominio] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open || clientes.length > 0) return
    ;(createClient() as any)
      .from('clientes')
      .select('id, nome, empresa')
      .order('nome')
      .then(({ data }: { data: ClienteOpcao[] | null }) => setClientes(data ?? []))
  }, [open, clientes.length])

  async function salvar() {
    if (!clienteId || !nome.trim()) return
    setSalvando(true)
    setErro(null)
    const dominioLimpo = dominio.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    const { data, error } = await (createClient() as any)
      .from('sites_clientes')
      .insert({ cliente_id: clienteId, nome: nome.trim(), dominio: dominioLimpo || null })
      .select('id')
      .single()
    setSalvando(false)
    if (error || !data) {
      setErro('Não foi possível salvar. A migration de sites dos clientes já foi aplicada no Supabase?')
      return
    }
    onCriado(data.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo site</DialogTitle>
          <DialogDescription>Depois de salvar, gere a chave e coloque no projeto do site.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Select value={clienteId} onValueChange={(id) => {
              setClienteId(id)
              const c = clientes.find((x) => x.id === id)
              if (c && !nome.trim()) setNome(`Site ${c.empresa || c.nome}`)
            }}>
              <SelectTrigger><SelectValue placeholder="Escolha o cliente" /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.empresa ? `${c.empresa} (${c.nome})` : c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nome do site *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Site Performei" />
          </div>
          <div className="space-y-1.5">
            <Label>Domínio</Label>
            <Input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="performei.com.br" />
          </div>
          {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !clienteId || !nome.trim()}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

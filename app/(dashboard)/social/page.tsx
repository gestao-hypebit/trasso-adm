'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Eye, Loader2, Megaphone, Plus, Search } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { ERRO_MIGRATION, STATUS_PLANEJAMENTO, nomeMes } from '@/lib/social/tipos'
import { formatDate } from '@/lib/utils'

type Linha = {
  id: string; titulo: string; mes: string; status: string; visualizacoes: number; ultima_visualizacao: string | null
  clientes: { nome: string; empresa: string | null } | null
  social_posts: { aprovacao: string }[]
}
type Opcao = { id: string; nome: string; empresa: string | null }

const proximoMes = () => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function SocialPage() {
  const router = useRouter()
  const [planos, setPlanos] = useState<Linha[]>([])
  const [clientes, setClientes] = useState<Opcao[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)
  const [form, setForm] = useState({ cliente: '', mes: proximoMes(), objetivo: '' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const db = createClient() as any
    Promise.all([
      db.from('social_planejamentos')
        .select('id, titulo, mes, status, visualizacoes, ultima_visualizacao, clientes(nome, empresa), social_posts(aprovacao)')
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false }),
      db.from('clientes').select('id, nome, empresa').order('nome'),
    ]).then(([p, c]: { data: any[] | null; error: { code?: string; message: string } | null }[]) => {
      if (p.error) setErro(p.error.code === '42P01' ? ERRO_MIGRATION : p.error.message)
      setPlanos(p.data ?? [])
      setClientes(c.data ?? [])
      setLoading(false)
    })
  }, [])

  async function criar() {
    if (!form.cliente) { setErro('Escolha o cliente.'); return }
    setSalvando(true)
    setErro(null)
    const cliente = clientes.find((c) => c.id === form.cliente)
    const mes = `${form.mes}-01`
    const { data, error } = await (createClient() as any)
      .from('social_planejamentos')
      .insert({
        cliente_id: form.cliente,
        mes,
        titulo: `${cliente?.empresa || cliente?.nome} · ${nomeMes(mes)}`,
        objetivo: form.objetivo.trim() || null,
      })
      .select('id')
      .single()
    setSalvando(false)
    if (error) { setErro(error.code === '42P01' ? ERRO_MIGRATION : error.message); return }
    router.push(`/social/${data.id}`)
  }

  const termo = busca.toLowerCase()
  const visiveis = planos.filter((p) => !termo || [p.titulo, p.clientes?.nome, p.clientes?.empresa].some((v) => v?.toLowerCase().includes(termo)))

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Social media" description="Planejamento de conteúdo dos clientes" />
      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="Social media" description="Monte o calendário do mês, mande para o cliente aprovar e exporte em PDF.">
          <Button size="sm" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Novo planejamento</Button>
        </PageHeader>

        {erro && !novo && <p className="mb-4 text-sm text-brand-rosa">{erro}</p>}

        {planos.length > 0 && (
          <div className="relative mb-5 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-lavanda/40" />
            <Input className="pl-9" placeholder="Buscar por cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        )}

        {loading ? (
          <p className="py-20 text-center text-sm text-brand-lavanda/40">Carregando...</p>
        ) : planos.length === 0 && !erro ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Megaphone className="h-8 w-8 text-brand-lima" />
              <p className="text-base font-medium text-brand-lavanda">Nenhum planejamento ainda</p>
              <p className="max-w-md text-sm text-brand-lavanda/50">Escolha o cliente e o mês, monte os posts no calendário (ou peça uma pauta para a IA) e mande o link para o cliente aprovar.</p>
              <Button className="mt-2" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Criar o primeiro</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visiveis.map((p) => {
              const st = STATUS_PLANEJAMENTO[p.status] ?? STATUS_PLANEJAMENTO.rascunho
              const total = p.social_posts.length
              const aprovados = p.social_posts.filter((x) => x.aprovacao === 'aprovado').length
              const ajustes = p.social_posts.filter((x) => x.aprovacao === 'ajustes').length
              return (
                <Link key={p.id} href={`/social/${p.id}`} className="group">
                  <Card className="h-full transition-colors group-hover:border-white/[0.16]">
                    <CardContent className="flex h-full flex-col gap-3 p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] leading-none">
                          <span className="text-[9px] uppercase text-brand-lavanda/50">{nomeMes(p.mes).slice(0, 3)}</span>
                          <span className="text-sm font-bold text-brand-lima">{p.mes.slice(2, 4)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-brand-lavanda group-hover:text-brand-lima">{p.clientes?.empresa || p.clientes?.nome}</p>
                          <p className="truncate text-xs capitalize text-brand-lavanda/40">{nomeMes(p.mes)}</p>
                        </div>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      {total > 0 && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className="h-full bg-brand-lima" style={{ width: `${(aprovados / total) * 100}%` }} />
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-between text-xs text-brand-lavanda/40">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> {total} post{total === 1 ? '' : 's'}
                          {total > 0 && p.status !== 'rascunho' && <> · {aprovados} aprovado{aprovados === 1 ? '' : 's'}</>}
                          {ajustes > 0 && <span className="text-brand-rosa/80"> · {ajustes} ajuste{ajustes === 1 ? '' : 's'}</span>}
                        </span>
                        {p.status !== 'rascunho' && (
                          <span className={p.visualizacoes > 0 ? 'flex items-center gap-1 text-brand-lima/80' : 'flex items-center gap-1'} title={p.ultima_visualizacao ? `Última: ${formatDate(p.ultima_visualizacao, 'dd/MM/yyyy HH:mm')}` : 'Ainda não abriram o link'}>
                            <Eye className="h-3.5 w-3.5" /> {p.visualizacoes}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo planejamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <select
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                className="h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-brand-lavanda outline-none"
              >
                <option value="" className="bg-brand-noite">Escolha...</option>
                {clientes.map((c) => <option key={c.id} value={c.id} className="bg-brand-noite">{c.nome}{c.empresa && c.empresa !== c.nome ? ` · ${c.empresa}` : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Mês</Label>
              <Input type="month" value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Objetivo do mês (opcional)</Label>
              <Input placeholder="Ex.: lançar o cardápio de verão e aumentar pedidos no delivery" value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
            </div>
            {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setNovo(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={criar} disabled={salvando || !form.mes}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

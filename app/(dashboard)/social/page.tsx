'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, ClipboardList, Eye, Loader2, Megaphone, Plus, Search } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GerarBriefingDialog } from '@/components/social/briefing-painel'
import { createClient } from '@/lib/supabase/client'
import { ERRO_MIGRATION_BRIEFING, STATUS_BRIEFING, type StatusBriefing } from '@/lib/social/briefing'
import { ERRO_MIGRATION, ERRO_MIGRATION_PERIODO, STATUS_PLANEJAMENTO, fimDoPeriodo, nomeMes, nomePeriodo, umMesDepois } from '@/lib/social/tipos'
import { cn, formatDate } from '@/lib/utils'
import { SkeletonLista } from '@/components/ui/skeleton'

type Linha = {
  id: string; cliente_id: string; titulo: string; mes: string; data_fim: string | null; status: string; visualizacoes: number; ultima_visualizacao: string | null
  clientes: { nome: string; empresa: string | null } | null
  social_posts: { aprovacao: string }[]
}
type Opcao = { id: string; nome: string; empresa: string | null }
type BriefingLinha = { cliente_id: string; status: StatusBriefing; created_at: string }
type Aba = 'planejamentos' | 'clientes'

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
  const [form, setForm] = useState({ cliente: '', tipo: 'mes' as 'mes' | 'periodo', mes: proximoMes(), inicio: '', fim: '', objetivo: '' })
  const [salvando, setSalvando] = useState(false)
  const [aba, setAba] = useState<Aba>('planejamentos')
  const [briefings, setBriefings] = useState<BriefingLinha[]>([])
  const [erroBriefing, setErroBriefing] = useState<string | null>(null)
  const [gerarBriefing, setGerarBriefing] = useState(false)

  // A aba fica na URL (?aba=clientes) para o "voltar" da página do cliente cair nela.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('aba') === 'clientes') setAba('clientes')
  }, [])

  function trocarAba(v: Aba) {
    setAba(v)
    window.history.replaceState(null, '', v === 'clientes' ? '/social?aba=clientes' : '/social')
  }

  useEffect(() => {
    const db = createClient() as any
    Promise.all([
      db.from('social_planejamentos')
        .select('id, cliente_id, titulo, mes, data_fim, status, visualizacoes, ultima_visualizacao, clientes(nome, empresa), social_posts(aprovacao)')
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false }),
      db.from('clientes').select('id, nome, empresa').order('nome'),
      db.from('social_briefings').select('cliente_id, status, created_at').order('created_at', { ascending: false }),
    ]).then(([p, c, b]: { data: any[] | null; error: { code?: string; message: string } | null }[]) => {
      if (p.error) setErro(p.error.code === '42P01' ? ERRO_MIGRATION : p.error.message)
      if (b.error) setErroBriefing(b.error.code === '42P01' ? ERRO_MIGRATION_BRIEFING : b.error.message)
      setPlanos(p.data ?? [])
      setClientes(c.data ?? [])
      setBriefings(b.data ?? [])
      setLoading(false)
    })
  }, [])

  async function criar() {
    if (!form.cliente) { setErro('Escolha o cliente.'); return }
    const mes = form.tipo === 'mes' ? `${form.mes}-01` : form.inicio
    const fim = form.tipo === 'mes' ? fimDoPeriodo(mes) : form.fim
    if (!mes || !fim) { setErro('Informe o início e o fim do período.'); return }
    if (fim < mes) { setErro('O fim do período tem que ser depois do início.'); return }
    setSalvando(true)
    setErro(null)
    const cliente = clientes.find((c) => c.id === form.cliente)
    const { data, error } = await (createClient() as any)
      .from('social_planejamentos')
      .insert({
        cliente_id: form.cliente,
        mes,
        data_fim: fim,
        titulo: `${cliente?.empresa || cliente?.nome} · ${nomePeriodo(mes, fim)}`,
        objetivo: form.objetivo.trim() || null,
      })
      .select('id')
      .single()
    setSalvando(false)
    if (error) { setErro(error.code === '42P01' ? ERRO_MIGRATION : error.message.includes('data_fim') ? ERRO_MIGRATION_PERIODO : error.message); return }
    router.push(`/social/${data.id}`)
  }

  const termo = busca.toLowerCase()
  const visiveis = planos.filter((p) => !termo || [p.titulo, p.clientes?.nome, p.clientes?.empresa].some((v) => v?.toLowerCase().includes(termo)))

  // Clientes de social media: quem tem planejamento ou briefing. O status é o do briefing mais recente.
  const clientesSocial = clientes
    .map((c) => {
      const doCliente = planos.filter((p) => p.cliente_id === c.id)
      const briefing = briefings.find((b) => b.cliente_id === c.id)
      return { ...c, planos: doCliente.length, ultimoPlano: doCliente[0] ?? null, briefing: briefing?.status ?? ('sem' as const) }
    })
    .filter((c) => c.planos > 0 || c.briefing !== 'sem')
  const clientesVisiveis = clientesSocial.filter((c) => !termo || [c.nome, c.empresa].some((v) => v?.toLowerCase().includes(termo)))

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Social media" description="Planejamento de conteúdo dos clientes" />
      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="Social media" description="Monte o calendário do mês, mande para o cliente aprovar e exporte em PDF.">
          <Button size="sm" variant="outline" onClick={() => setGerarBriefing(true)}><ClipboardList className="h-4 w-4" /> Gerar briefing</Button>
          <Button size="sm" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Novo planejamento</Button>
        </PageHeader>

        <div className="mb-5 flex w-fit gap-1 rounded-lg border border-white/[0.06] p-0.5">
          {([['planejamentos', 'Planejamentos'], ['clientes', 'Clientes']] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => trocarAba(v)}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', aba === v ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50 hover:text-brand-lavanda')}>
              {label}
            </button>
          ))}
        </div>

        {erro && !novo && <p className="mb-4 text-sm text-brand-rosa">{erro}</p>}

        {(aba === 'clientes' ? clientesSocial : planos).length > 0 && (
          <div className="relative mb-5 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-lavanda/40" />
            <Input className="pl-9" placeholder="Buscar por cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        )}

        {loading ? (
          <SkeletonLista />
        ) : aba === 'clientes' ? (
          <>
            {erroBriefing && <p className="mb-4 text-sm text-brand-rosa">{erroBriefing}</p>}
            {clientesSocial.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <ClipboardList className="h-8 w-8 text-brand-lima" />
                  <p className="text-base font-medium text-brand-lavanda">Nenhum cliente de social media ainda</p>
                  <p className="max-w-md text-sm text-brand-lavanda/50">Os clientes aparecem aqui quando têm um briefing ou um planejamento. Comece gerando o briefing de um cliente novo.</p>
                  <Button className="mt-2" onClick={() => setGerarBriefing(true)}><ClipboardList className="h-4 w-4" /> Gerar briefing</Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="divide-y divide-white/[0.06] p-0">
                  {clientesVisiveis.map((c) => {
                    const st = STATUS_BRIEFING[c.briefing]
                    return (
                      <Link key={c.id} href={`/social/clientes/${c.id}`} className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-white/[0.02]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-brand-lavanda group-hover:text-brand-lima">{c.empresa || c.nome}</p>
                          {c.empresa && c.empresa !== c.nome && <p className="truncate text-xs text-brand-lavanda/40">{c.nome}</p>}
                        </div>
                        <span className="text-xs text-brand-lavanda/40">
                          {c.planos} planejamento{c.planos === 1 ? '' : 's'}
                          {c.ultimoPlano && <> · último {nomePeriodo(c.ultimoPlano.mes, c.ultimoPlano.data_fim)}</>}
                        </span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </Link>
                    )
                  })}
                  {clientesVisiveis.length === 0 && <p className="py-10 text-center text-sm text-brand-lavanda/40">Nenhum cliente encontrado.</p>}
                </CardContent>
              </Card>
            )}
          </>
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
                          <p className="truncate text-xs text-brand-lavanda/40">{nomePeriodo(p.mes, p.data_fim)}</p>
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

      <GerarBriefingDialog aberto={gerarBriefing} onClose={() => setGerarBriefing(false)} clientes={clientes}
        onCriado={(b) => router.push(`/social/clientes/${b.cliente_id}`)} />

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
              <div className="flex items-center justify-between">
                <Label>{form.tipo === 'mes' ? 'Mês' : 'Período'}</Label>
                <div className="flex gap-1 rounded-lg border border-white/[0.06] p-0.5">
                  {([['mes', 'Mês cheio'], ['periodo', 'Período']] as const).map(([v, label]) => (
                    <button key={v} type="button"
                      onClick={() => setForm(v === 'periodo' && !form.inicio
                        ? { ...form, tipo: v, inicio: `${form.mes}-01`, fim: fimDoPeriodo(`${form.mes}-01`) }
                        : { ...form, tipo: v })}
                      className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', form.tipo === v ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50 hover:text-brand-lavanda')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {form.tipo === 'mes' ? (
                <Input type="month" value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Ao mudar o início, o fim sugerido é a véspera do mesmo dia no mês seguinte (20 → 19). */}
                    <Input type="date" aria-label="Início" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value, fim: e.target.value ? umMesDepois(e.target.value) : form.fim })} />
                    <Input type="date" aria-label="Fim" value={form.fim} min={form.inicio || undefined} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
                  </div>
                  {form.inicio && form.fim && form.fim >= form.inicio && <p className="text-xs text-brand-lavanda/40">{nomePeriodo(form.inicio, form.fim)}</p>}
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Objetivo do mês (opcional)</Label>
              <Input placeholder="Ex.: lançar o cardápio de verão e aumentar pedidos no delivery" value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
            </div>
            {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setNovo(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={criar} disabled={salvando || (form.tipo === 'mes' ? !form.mes : !form.inicio || !form.fim)}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

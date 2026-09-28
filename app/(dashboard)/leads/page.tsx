'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Inbox, LayoutList } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LeadDetalheDialog, type Lead } from '@/components/leads/lead-detalhe-dialog'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative } from '@/lib/utils'
import { formatarValor, leadStatusConfig, type LeadStatus } from '@/lib/leads/formulario'

// Resumo curto do que o lead escreveu/escolheu, para a tabela.
function resumo(lead: Lead) {
  const r = lead.respostas.find((r) => Array.isArray(r.valor)) ?? lead.respostas.find((r) => r.chave === 'mensagem')
  return r ? formatarValor(r.valor) : ''
}

function LeadsConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('ativos')
  const [abertoId, setAbertoId] = useState<string | null>(searchParams.get('lead'))

  useEffect(() => {
    async function load() {
      const { data } = await (createClient() as any)
        .from('leads')
        .select('id, nome, email, telefone, empresa, respostas, status, origem, pagina, utm, cliente_id, observacoes, created_at, formularios(nome)')
        .order('created_at', { ascending: false })
      setLeads((data as Lead[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function abrir(id: string | null) {
    setAbertoId(id)
    router.replace(id ? `/leads?lead=${id}` : '/leads', { scroll: false })
  }

  const termo = busca.toLowerCase()
  const filtrados = leads.filter((l) => {
    const matchBusca = !termo || [l.nome, l.email, l.telefone, l.empresa].some((v) => v?.toLowerCase().includes(termo))
    const matchStatus =
      filtroStatus === 'todos' ||
      (filtroStatus === 'ativos' ? !['convertido', 'descartado'].includes(l.status) : l.status === filtroStatus)
    return matchBusca && matchStatus
  })

  const novos = leads.filter((l) => l.status === 'novo').length
  const convertidos = leads.filter((l) => l.status === 'convertido').length
  const taxa = leads.length ? Math.round((convertidos / leads.length) * 100) : 0
  const aberto = leads.find((l) => l.id === abertoId) ?? null

  const filtros = [
    { key: 'ativos', label: 'Em aberto', count: leads.filter((l) => !['convertido', 'descartado'].includes(l.status)).length },
    ...Object.entries(leadStatusConfig).map(([key, sc]) => ({ key, label: sc.label, count: leads.filter((l) => l.status === key).length })),
    { key: 'todos', label: 'Todos', count: leads.length },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Leads" description="Contatos recebidos pelo site" />

      <main className="flex-1 p-6">
        <PageHeader
          title="Leads"
          description={loading ? 'Carregando…' : `${novos} novo${novos === 1 ? '' : 's'} • ${leads.length} no total • ${taxa}% convertidos`}
        >
          <Button variant="outline" asChild>
            <Link href="/leads/formularios"><LayoutList className="h-4 w-4" /> Formulários</Link>
          </Button>
        </PageHeader>

        {!loading && leads.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {filtros.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFiltroStatus(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                  filtroStatus === key
                    ? 'border-brand-lima bg-brand-lima/20 text-brand-lima'
                    : 'border-white/[0.1] bg-white/[0.04] text-brand-lavanda/70 hover:border-white/[0.2] hover:text-brand-lavanda'
                )}
              >
                {label}
                <span className="rounded-full bg-white/[0.02] px-1.5">{count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
          <Input className="pl-9" placeholder="Buscar por nome, e-mail, telefone ou empresa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Lead</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Contato</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Interesse</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Recebido</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-16 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                  ) : filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <Inbox className="h-10 w-10 text-brand-lavanda/20 mx-auto mb-3" />
                        <p className="text-brand-lavanda/40 text-sm">
                          {leads.length === 0 ? 'Nenhum lead ainda. Os contatos do formulário do site aparecem aqui.' : 'Nenhum lead encontrado.'}
                        </p>
                      </td>
                    </tr>
                  ) : filtrados.map((l) => {
                    const sc = leadStatusConfig[l.status as LeadStatus]
                    return (
                      <tr key={l.id} onClick={() => abrir(l.id)} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            {l.status === 'novo' && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-lima" aria-label="Novo" />}
                            <div className="min-w-0">
                              <p className={cn('truncate max-w-[220px] group-hover:text-brand-lima transition-colors', l.status === 'novo' ? 'font-semibold text-brand-lavanda' : 'font-medium text-brand-lavanda/80')}>{l.nome}</p>
                              {l.empresa && <p className="text-xs text-brand-lavanda/40 truncate max-w-[220px]">{l.empresa}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-brand-lavanda/60">
                          <p>{l.telefone ?? '—'}</p>
                          {l.email && <p className="text-brand-lavanda/40">{l.email}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-brand-lavanda/60">
                          <p className="truncate max-w-[280px]">{resumo(l) || '—'}</p>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-brand-lavanda/50 whitespace-nowrap">{formatRelative(l.created_at)}</td>
                        <td className="px-4 py-3.5">{sc && <Badge variant={sc.variant}>{sc.label}</Badge>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>

      <LeadDetalheDialog
        lead={aberto}
        onOpenChange={(open) => !open && abrir(null)}
        onChange={(lead) => setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)))}
        onDelete={(id) => {
          setLeads((prev) => prev.filter((l) => l.id !== id))
          abrir(null)
        }}
      />
    </div>
  )
}

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsConteudo />
    </Suspense>
  )
}

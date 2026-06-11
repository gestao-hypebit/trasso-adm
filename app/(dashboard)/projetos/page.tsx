'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, List, Kanban, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { isBefore } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

type Projeto = {
  id: string
  nome: string
  descricao: string | null
  tipo: string | null
  status: string
  prioridade: string
  progresso: number
  valor: number | null
  data_entrega: string | null
  clientes: { nome: string } | null
  responsavel: { nome: string } | null
}

const statusColumns = [
  { key: 'backlog', label: 'Backlog', color: 'border-brand-lavanda/20' },
  { key: 'em_andamento', label: 'Em Andamento', color: 'border-white/[0.15]' },
  { key: 'aguardando_cliente', label: 'Aguardando Cliente', color: 'border-yellow-500/50' },
  { key: 'em_revisao', label: 'Em Revisão', color: 'border-brand-lima/50' },
  { key: 'concluido', label: 'Concluído', color: 'border-brand-lima/80' },
]

const prioridadeCores: Record<string, string> = {
  baixa: 'text-brand-lavanda/50 border-brand-lavanda/20 bg-brand-lavanda/5',
  media: 'text-brand-violeta border-white/[0.1] bg-brand-violeta/10',
  alta: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  urgente: 'text-brand-rosa border-brand-rosa/30 bg-brand-rosa/10',
}

const tipoLabel: Record<string, string> = {
  identidade_visual: 'ID Visual', site: 'Site', software: 'Software',
  marketing: 'Marketing', social_media: 'Social', outro: 'Outro',
}

function ProjetoCard({ projeto }: { projeto: Projeto }) {
  const isVencido = projeto.data_entrega && isBefore(new Date(projeto.data_entrega), new Date()) && projeto.status !== 'concluido'

  return (
    <Link href={`/projetos/${projeto.id}`}>
      <Card className="hover:border-white/[0.12] transition-all hover:shadow-lg hover:shadow-brand-violeta/5 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-brand-lavanda text-sm leading-tight">{projeto.nome}</p>
              <p className="text-xs text-brand-lavanda/50 mt-0.5">{projeto.clientes?.nome ?? 'Sem cliente'}</p>
            </div>
            <Badge className={cn('text-[10px] shrink-0 border', prioridadeCores[projeto.prioridade])}>
              {projeto.prioridade}
            </Badge>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-brand-lavanda/50 mb-1">
              <span>Progresso</span>
              <span>{projeto.progresso}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-brand-noite/80">
              <div
                className="h-1.5 rounded-full bg-brand-violeta transition-all"
                style={{ width: `${projeto.progresso}%`, background: projeto.progresso === 100 ? '#B8F000' : '#7C3AED' }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {projeto.tipo && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-brand-lavanda/70">
                  {tipoLabel[projeto.tipo] || projeto.tipo}
                </span>
              )}
              {isVencido && <AlertTriangle className="h-3 w-3 text-brand-rosa" />}
            </div>
            <div className="flex items-center gap-2">
              {projeto.data_entrega && (
                <span className={cn('text-xs', isVencido ? 'text-brand-rosa' : 'text-brand-lavanda/50')}>
                  {formatDate(projeto.data_entrega, 'dd/MM')}
                </span>
              )}
              {projeto.responsavel && (
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">{getInitials(projeto.responsavel.nome)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data } = await supabase
        .from('projetos')
        .select('id, nome, descricao, tipo, status, prioridade, progresso, valor, data_entrega, clientes(nome), responsavel:profiles!projetos_responsavel_id_fkey(nome)')
        .order('created_at', { ascending: false })
      setProjetos((data as Projeto[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <Header title="Projetos" description="Gerencie seus projetos" />
      <div className="p-6">
        <PageHeader title="Projetos" description={`${projetos.length} projetos`}>
          <div className="flex items-center gap-2">
            <Button variant={view === 'kanban' ? 'violeta' : 'ghost'} size="icon" onClick={() => setView('kanban')} title="Kanban">
              <Kanban className="h-4 w-4" />
            </Button>
            <Button variant={view === 'lista' ? 'violeta' : 'ghost'} size="icon" onClick={() => setView('lista')} title="Lista">
              <List className="h-4 w-4" />
            </Button>
            <Link href="/projetos/novo">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Novo Projeto
              </Button>
            </Link>
          </div>
        </PageHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : view === 'kanban' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statusColumns.map((col) => {
              const cols = projetos.filter((p) => p.status === col.key)
              return (
                <div key={col.key} className={cn('flex-shrink-0 w-72 rounded-xl border bg-white/[0.02] p-3', col.color)}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-brand-lavanda">{col.label}</h3>
                    <span className="text-xs text-brand-lavanda/40 bg-white/[0.06] rounded-full px-2 py-0.5">{cols.length}</span>
                  </div>
                  <div className="space-y-3">
                    {cols.map((p) => <ProjetoCard key={p.id} projeto={p} />)}
                    {cols.length === 0 && (
                      <p className="text-xs text-brand-lavanda/30 text-center py-4">Nenhum projeto</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {projetos.map((p) => (
              <Link key={p.id} href={`/projetos/${p.id}`}>
                <Card className="hover:border-white/[0.12] transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-brand-lavanda">{p.nome}</p>
                      <p className="text-xs text-brand-lavanda/50">{p.clientes?.nome ?? 'Sem cliente'}</p>
                    </div>
                    {p.tipo && (
                      <span className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-brand-lavanda/70 hidden sm:block">
                        {tipoLabel[p.tipo] ?? p.tipo}
                      </span>
                    )}
                    <div className="flex items-center gap-2 w-32">
                      <div className="flex-1 h-1.5 rounded-full bg-brand-noite/80">
                        <div className="h-1.5 rounded-full bg-brand-violeta" style={{ width: `${p.progresso}%` }} />
                      </div>
                      <span className="text-xs text-brand-lavanda/50 w-8 text-right">{p.progresso}%</span>
                    </div>
                    {p.valor != null && (
                      <span className="text-sm font-semibold text-brand-lavanda hidden md:block">{formatCurrency(p.valor)}</span>
                    )}
                    {p.data_entrega && (
                      <span className="text-xs text-brand-lavanda/50 hidden sm:block">{formatDate(p.data_entrega)}</span>
                    )}
                    <Badge className={cn('text-[10px] border', prioridadeCores[p.prioridade])} variant="outline">
                      {p.prioridade}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {projetos.length === 0 && (
              <p className="text-center text-brand-lavanda/40 py-16 text-sm">Nenhum projeto encontrado.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

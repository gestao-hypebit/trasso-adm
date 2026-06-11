'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit, Plus, CheckCircle2, Clock } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Projeto = {
  id: string; nome: string; descricao: string | null; tipo: string | null; status: string
  prioridade: string; progresso: number; valor: number | null; data_inicio: string | null; data_entrega: string | null
  clientes: { nome: string } | null
}
type Tarefa = {
  id: string; titulo: string; status: string; prioridade: string; data_vencimento: string | null
}

const tarefaStatusColunas = [
  { key: 'a_fazer', label: 'A Fazer' },
  { key: 'em_andamento', label: 'Em Andamento' },
  { key: 'revisao', label: 'Revisão' },
  { key: 'concluida', label: 'Concluída' },
]

export default function ProjetoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [projeto, setProjeto] = useState<Projeto | null>(null)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from('projetos').select('id, nome, descricao, tipo, status, prioridade, progresso, valor, data_inicio, data_entrega, clientes(nome)').eq('id', id).single(),
        supabase.from('tarefas').select('id, titulo, status, prioridade, data_vencimento').eq('projeto_id', id).order('ordem'),
      ])
      setProjeto(p as unknown as Projeto)
      setTarefas(t ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="p-6 text-brand-lavanda/40 text-sm">Carregando...</div>
  if (!projeto) return (
    <div className="p-6">
      <Link href="/projetos"><Button variant="outline" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button></Link>
      <p className="mt-6 text-brand-lavanda/50">Projeto não encontrado.</p>
    </div>
  )

  const concluidas = tarefas.filter(t => t.status === 'concluida').length

  return (
    <div>
      <Header title="Detalhe do Projeto" />
      <div className="p-6">
        <div className="mb-4 flex justify-between">
          <Link href="/projetos">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-2">
            <Edit className="h-4 w-4" /> Editar
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {projeto.nome}
                </h2>
                <p className="text-brand-lavanda/60 mt-0.5">{projeto.clientes?.nome ?? 'Sem cliente'}</p>
                {projeto.descricao && <p className="text-sm text-brand-lavanda/70 mt-2 max-w-2xl">{projeto.descricao}</p>}
              </div>
              <div className="flex flex-wrap gap-3">
                {projeto.valor != null && (
                  <div className="text-center">
                    <p className="text-xs text-brand-lavanda/50">Valor</p>
                    <p className="text-lg font-bold text-brand-lima">{formatCurrency(projeto.valor)}</p>
                  </div>
                )}
                {projeto.data_entrega && (
                  <div className="text-center">
                    <p className="text-xs text-brand-lavanda/50">Entrega</p>
                    <p className="text-lg font-bold text-brand-lavanda">{formatDate(projeto.data_entrega)}</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-xs text-brand-lavanda/50">Progresso</p>
                  <p className="text-lg font-bold text-brand-violeta">{projeto.progresso}%</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 rounded-full bg-brand-noite/80">
                <div className="h-2 rounded-full bg-brand-violeta transition-all" style={{ width: `${projeto.progresso}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="tarefas">
          <TabsList className="mb-4">
            <TabsTrigger value="tarefas">Tarefas ({tarefas.length})</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>

          <TabsContent value="tarefas">
            <div className="flex justify-end mb-3">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Nova Tarefa
              </Button>
            </div>
            {tarefas.length === 0 ? (
              <p className="text-center text-brand-lavanda/40 py-12 text-sm">Nenhuma tarefa neste projeto.</p>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {tarefaStatusColunas.map((col) => {
                  const ts = tarefas.filter((t) => t.status === col.key)
                  return (
                    <div key={col.key} className="flex-shrink-0 w-64 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-brand-lavanda">{col.label}</h3>
                        <span className="text-xs text-brand-lavanda/40 bg-white/[0.06] rounded-full px-2 py-0.5">{ts.length}</span>
                      </div>
                      <div className="space-y-2">
                        {ts.map((t) => (
                          <Card key={t.id}>
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                {t.status === 'concluida'
                                  ? <CheckCircle2 className="h-4 w-4 text-brand-lima shrink-0 mt-0.5" />
                                  : <Clock className="h-4 w-4 text-brand-violeta shrink-0 mt-0.5" />
                                }
                                <div>
                                  <p className={cn('text-xs font-medium', t.status === 'concluida' ? 'text-brand-lavanda/50 line-through' : 'text-brand-lavanda')}>{t.titulo}</p>
                                  {t.data_vencimento && <p className="text-[10px] text-brand-lavanda/40 mt-1">{formatDate(t.data_vencimento)}</p>}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {ts.length === 0 && <p className="text-xs text-brand-lavanda/20 text-center py-3">Vazio</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="financeiro">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card><CardContent className="p-5 text-center">
                <p className="text-xs text-brand-lavanda/50 uppercase tracking-wider">Valor Total</p>
                <p className="text-2xl font-bold text-brand-lavanda mt-1">{formatCurrency(projeto.valor ?? 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-5 text-center">
                <p className="text-xs text-brand-lavanda/50 uppercase tracking-wider">Tarefas</p>
                <p className="text-2xl font-bold text-brand-lima mt-1">{tarefas.length}</p>
              </CardContent></Card>
              <Card><CardContent className="p-5 text-center">
                <p className="text-xs text-brand-lavanda/50 uppercase tracking-wider">Concluídas</p>
                <p className="text-2xl font-bold text-brand-violeta mt-1">{concluidas}</p>
              </CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

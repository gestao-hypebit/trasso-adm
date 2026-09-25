'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit, Plus, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { RentabilidadeProjeto } from '@/components/projetos/rentabilidade-projeto'

const TAREFA_VAZIA = { titulo: '', prioridade: 'media', data_vencimento: '', descricao: '' }

type Projeto = {
  id: string; nome: string; descricao: string | null; tipo: string | null; status: string
  prioridade: string; progresso: number; valor: number | null; data_inicio: string | null; data_entrega: string | null
  horas_estimadas: number | null
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
  const [tarefaOpen, setTarefaOpen] = useState(false)
  const [tarefaForm, setTarefaForm] = useState(TAREFA_VAZIA)
  const [salvandoTarefa, setSalvandoTarefa] = useState(false)

  async function criarTarefa() {
    if (!tarefaForm.titulo.trim()) return
    setSalvandoTarefa(true)
    const { data, error } = await (createClient() as any)
      .from('tarefas')
      .insert({
        projeto_id: id,
        titulo: tarefaForm.titulo.trim(),
        prioridade: tarefaForm.prioridade,
        data_vencimento: tarefaForm.data_vencimento || null,
        descricao: tarefaForm.descricao.trim() || null,
        status: 'a_fazer',
        ordem: tarefas.length,
      })
      .select('id, titulo, status, prioridade, data_vencimento')
      .single()
    setSalvandoTarefa(false)
    if (!error && data) {
      setTarefas((prev) => [...prev, data as Tarefa])
      setTarefaForm(TAREFA_VAZIA)
      setTarefaOpen(false)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from('projetos').select('*, clientes(nome)').eq('id', id).single(),
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
          <Link href={`/projetos/${id}/editar`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Edit className="h-4 w-4" /> Editar
            </Button>
          </Link>
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
            <TabsTrigger value="financeiro">Rentabilidade</TabsTrigger>
          </TabsList>

          <TabsContent value="tarefas">
            <div className="flex justify-end mb-3">
              <Button size="sm" className="gap-2" onClick={() => setTarefaOpen(true)}>
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
            <RentabilidadeProjeto projetoId={id} valorProjeto={projeto.valor} horasEstimadas={projeto.horas_estimadas ?? null} />
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={tarefaOpen} onOpenChange={setTarefaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={tarefaForm.titulo} onChange={(e) => setTarefaForm({ ...tarefaForm, titulo: e.target.value })} placeholder="Ex: Criar wireframes" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={tarefaForm.prioridade} onValueChange={(v) => setTarefaForm({ ...tarefaForm, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input type="date" value={tarefaForm.data_vencimento} onChange={(e) => setTarefaForm({ ...tarefaForm, data_vencimento: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={3} value={tarefaForm.descricao} onChange={(e) => setTarefaForm({ ...tarefaForm, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setTarefaOpen(false)} disabled={salvandoTarefa}>Cancelar</Button>
            <Button onClick={criarTarefa} disabled={salvandoTarefa || !tarefaForm.titulo.trim()}>
              {salvandoTarefa ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar tarefa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

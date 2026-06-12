'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Calendar } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { isBefore, isToday, isTomorrow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

type Tarefa = {
  id: string
  titulo: string
  descricao: string | null
  status: string
  prioridade: string
  data_vencimento: string | null
  projetos: { nome: string } | null
  responsavel: { nome: string } | null
}

type ProjetoOpcao = { id: string; nome: string }

const formVazio = { titulo: '', projeto_id: '', prioridade: 'media', data_vencimento: '', descricao: '' }

const colunas = [
  { key: 'a_fazer', label: 'A Fazer', cor: 'border-brand-lavanda/20' },
  { key: 'em_andamento', label: 'Em Andamento', cor: 'border-white/[0.15]' },
  { key: 'revisao', label: 'Revisão', cor: 'border-brand-lima/50' },
  { key: 'concluida', label: 'Concluída', cor: 'border-brand-rosa/30' },
]

const prioridadeConfig = {
  baixa:   { label: 'Baixa',   cor: 'text-brand-lavanda/50', bg: 'bg-brand-lavanda/10' },
  media:   { label: 'Média',   cor: 'text-brand-violeta',    bg: 'bg-brand-violeta/10' },
  alta:    { label: 'Alta',    cor: 'text-yellow-400',        bg: 'bg-yellow-400/10' },
  urgente: { label: 'Urgente', cor: 'text-brand-rosa',        bg: 'bg-brand-rosa/10' },
}

function vencimentoLabel(data: string) {
  const d = new Date(data + 'T12:00:00')
  if (isBefore(d, new Date()) && !isToday(d)) return { label: 'Atrasada', cor: 'text-brand-rosa' }
  if (isToday(d)) return { label: 'Hoje', cor: 'text-yellow-400' }
  if (isTomorrow(d)) return { label: 'Amanhã', cor: 'text-brand-lima/70' }
  return { label: formatDate(data), cor: 'text-brand-lavanda/40' }
}

export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [projetosOpcoes, setProjetosOpcoes] = useState<ProjetoOpcao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroProj, setFiltroProj] = useState('todos')
  const [filtroPrio, setFiltroPrio] = useState('todas')
  const [busca, setBusca] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: tarefasData }, { data: projetosData }] = await Promise.all([
        supabase
          .from('tarefas')
          .select('id, titulo, descricao, status, prioridade, data_vencimento, projetos(nome), responsavel:profiles!tarefas_responsavel_id_fkey(nome)')
          .order('ordem', { ascending: true }),
        supabase.from('projetos').select('id, nome').order('nome'),
      ])
      setTarefas((tarefasData as Tarefa[]) ?? [])
      setProjetosOpcoes((projetosData as ProjetoOpcao[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function criarTarefa() {
    if (!form.titulo.trim()) return
    setSalvando(true)
    const supabase = createClient()
    const { data, error } = await (supabase as any)
      .from('tarefas')
      .insert({
        titulo: form.titulo.trim(),
        projeto_id: form.projeto_id || null,
        prioridade: form.prioridade,
        data_vencimento: form.data_vencimento || null,
        descricao: form.descricao.trim() || null,
        status: 'a_fazer',
      })
      .select('id, titulo, descricao, status, prioridade, data_vencimento, projetos(nome), responsavel:profiles!tarefas_responsavel_id_fkey(nome)')
      .single()
    setSalvando(false)
    if (!error && data) {
      setTarefas(prev => [...prev, data as Tarefa])
      setOpen(false)
      setForm(formVazio)
    }
  }

  const projetos = Array.from(new Set(tarefas.map(t => t.projetos?.nome).filter(Boolean))) as string[]

  const tarefasFiltradas = tarefas.filter((t) => {
    const matchBusca = t.titulo.toLowerCase().includes(busca.toLowerCase())
    const matchProj = filtroProj === 'todos' || t.projetos?.nome === filtroProj
    const matchPrio = filtroPrio === 'todas' || t.prioridade === filtroPrio
    return matchBusca && matchProj && matchPrio
  })

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Tarefas" description="Kanban de todas as tarefas" />

      <main className="flex-1 p-6">
        <PageHeader title="Tarefas">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Tarefa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Título *</Label>
                  <Input
                    placeholder="Ex: Criar wireframes do app"
                    value={form.titulo}
                    onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Projeto</Label>
                    <Select value={form.projeto_id} onValueChange={v => setForm(f => ({ ...f, projeto_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {projetosOpcoes.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Prioridade</Label>
                    <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(prioridadeConfig).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={form.data_vencimento}
                    onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Descrição</Label>
                  <Textarea
                    placeholder="Detalhes da tarefa..."
                    rows={2}
                    value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={criarTarefa} disabled={!form.titulo.trim() || salvando}>
                  {salvando ? 'Criando...' : 'Criar Tarefa'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PageHeader>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
            <Input className="pl-9" placeholder="Buscar tarefa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroProj} onValueChange={setFiltroProj}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os projetos</SelectItem>
              {projetos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroPrio} onValueChange={setFiltroPrio}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {Object.entries(prioridadeConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto">
            {colunas.map((col) => {
              const tarefasCol = tarefasFiltradas.filter(t => t.status === col.key)
              return (
                <div key={col.key} className={cn('rounded-xl border-t-2 bg-brand-noite/30 min-h-[400px]', col.cor)}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                    <h3 className="text-sm font-semibold text-brand-lavanda">{col.label}</h3>
                    <span className="text-xs text-brand-lavanda/50 bg-brand-noite/60 rounded-full px-2 py-0.5">
                      {tarefasCol.length}
                    </span>
                  </div>
                  <div className="p-3 space-y-2">
                    {tarefasCol.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-brand-lavanda/20">
                        <p className="text-xs">Nenhuma tarefa</p>
                      </div>
                    ) : tarefasCol.map((tarefa) => {
                      const pc = prioridadeConfig[tarefa.prioridade as keyof typeof prioridadeConfig]
                      const vc = tarefa.data_vencimento ? vencimentoLabel(tarefa.data_vencimento) : null
                      return (
                        <Card key={tarefa.id} className="cursor-grab active:cursor-grabbing hover:border-white/[0.12] transition-colors">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-1">
                              <p className="text-sm text-brand-lavanda font-medium leading-snug">{tarefa.titulo}</p>
                              {pc && (
                                <span className={cn('shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md', pc.bg, pc.cor)}>
                                  {pc.label}
                                </span>
                              )}
                            </div>
                            {tarefa.projetos?.nome && (
                              <p className="text-xs text-brand-lavanda/40 truncate">{tarefa.projetos.nome}</p>
                            )}
                            <div className="flex items-center justify-between">
                              {vc && (
                                <span className={cn('text-[11px] flex items-center gap-1', vc.cor)}>
                                  <Calendar className="h-3 w-3" />
                                  {vc.label}
                                </span>
                              )}
                              {tarefa.responsavel?.nome && (
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-[9px] bg-white/[0.1] text-brand-lavanda">
                                    {getInitials(tarefa.responsavel.nome)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 hover:bg-white/[0.04] transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar tarefa
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

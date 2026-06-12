'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Calendar, GripVertical, Pencil, Trash2 } from 'lucide-react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  closestCorners, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
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

const SELECT_QUERY = 'id, titulo, descricao, status, prioridade, data_vencimento, projetos(nome), responsavel:profiles!tarefas_responsavel_id_fkey(nome)'

const formVazio = { titulo: '', projeto_id: '', prioridade: 'media', data_vencimento: '', descricao: '' }

const colunas = [
  { key: 'a_fazer',     label: 'A Fazer',      cor: 'border-brand-lavanda/20' },
  { key: 'em_andamento', label: 'Em Andamento', cor: 'border-white/[0.15]' },
  { key: 'revisao',     label: 'Revisão',       cor: 'border-brand-lima/50' },
  { key: 'concluida',   label: 'Concluída',     cor: 'border-brand-rosa/30' },
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
  if (isToday(d))    return { label: 'Hoje',   cor: 'text-yellow-400' }
  if (isTomorrow(d)) return { label: 'Amanhã', cor: 'text-brand-lima/70' }
  return { label: formatDate(data), cor: 'text-brand-lavanda/40' }
}

// ── Droppable column ──────────────────────────────────────────────────────────
function DroppableColuna({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'p-3 space-y-2 min-h-[320px] rounded-b-xl transition-colors',
        isOver && 'bg-brand-violeta/[0.06]'
      )}
    >
      {children}
    </div>
  )
}

// ── Draggable card ────────────────────────────────────────────────────────────
function DraggableCard({ tarefa, onEdit }: { tarefa: Tarefa; onEdit: (t: Tarefa) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarefa.id })
  const pc = prioridadeConfig[tarefa.prioridade as keyof typeof prioridadeConfig]
  const vc = tarefa.data_vencimento ? vencimentoLabel(tarefa.data_vencimento) : null

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn('transition-opacity', isDragging && 'opacity-30')}
    >
      <Card className="hover:border-white/[0.15] transition-colors group">
        <CardContent className="p-3">
          <div className="flex items-start gap-1.5">
            <button
              {...attributes}
              {...listeners}
              className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-brand-lavanda/20 hover:text-brand-lavanda/50 transition-colors"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0 space-y-1.5">
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

              {tarefa.descricao && (
                <p className="text-xs text-brand-lavanda/30 line-clamp-2 leading-relaxed">{tarefa.descricao}</p>
              )}

              <div className="flex items-center justify-between pt-0.5">
                {vc ? (
                  <span className={cn('text-[11px] flex items-center gap-1', vc.cor)}>
                    <Calendar className="h-3 w-3" />
                    {vc.label}
                  </span>
                ) : <span />}

                <div className="flex items-center gap-1">
                  {tarefa.responsavel?.nome && (
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px] bg-white/[0.1] text-brand-lavanda">
                        {getInitials(tarefa.responsavel.nome)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <button
                    onClick={() => onEdit(tarefa)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/[0.08] text-brand-lavanda/40 hover:text-brand-lavanda/70"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Ghost card shown in DragOverlay ──────────────────────────────────────────
function GhostCard({ tarefa }: { tarefa: Tarefa }) {
  const pc = prioridadeConfig[tarefa.prioridade as keyof typeof prioridadeConfig]
  return (
    <Card className="shadow-2xl border-brand-violeta/50 rotate-1 w-64 opacity-95">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm text-brand-lavanda font-medium leading-snug">{tarefa.titulo}</p>
          {pc && (
            <span className={cn('shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md', pc.bg, pc.cor)}>
              {pc.label}
            </span>
          )}
        </div>
        {tarefa.projetos?.nome && (
          <p className="text-xs text-brand-lavanda/40 truncate mt-1">{tarefa.projetos.nome}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Form fields (shared between create/edit) ──────────────────────────────────
function TarefaFormFields({
  form, onChange, projetos,
}: {
  form: typeof formVazio
  onChange: (patch: Partial<typeof formVazio>) => void
  projetos: ProjetoOpcao[]
}) {
  return (
    <div className="space-y-4 pt-2">
      <div>
        <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Título *</Label>
        <Input
          placeholder="Ex: Criar wireframes do app"
          value={form.titulo}
          onChange={e => onChange({ titulo: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Projeto</Label>
          <Select value={form.projeto_id} onValueChange={v => onChange({ projeto_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem projeto</SelectItem>
              {projetos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Prioridade</Label>
          <Select value={form.prioridade} onValueChange={v => onChange({ prioridade: v })}>
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
          onChange={e => onChange({ data_vencimento: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Descrição</Label>
        <Textarea
          placeholder="Detalhes da tarefa..."
          rows={3}
          value={form.descricao}
          onChange={e => onChange({ descricao: e.target.value })}
        />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [projetosOpcoes, setProjetosOpcoes] = useState<ProjetoOpcao[]>([])
  const [loading, setLoading] = useState(true)

  const [filtroProj, setFiltroProj] = useState('todos')
  const [filtroPrio, setFiltroPrio] = useState('todas')
  const [busca, setBusca] = useState('')

  const [openNova, setOpenNova] = useState(false)
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)

  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null)
  const [formEdit, setFormEdit] = useState(formVazio)
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  const [activeTarefa, setActiveTarefa] = useState<Tarefa | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: tarefasData }, { data: projetosData }] = await Promise.all([
        supabase.from('tarefas').select(SELECT_QUERY).order('ordem', { ascending: true }),
        supabase.from('projetos').select('id, nome').order('nome'),
      ])
      setTarefas((tarefasData as Tarefa[]) ?? [])
      setProjetosOpcoes((projetosData as ProjetoOpcao[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // ── DnD ────────────────────────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    setActiveTarefa(tarefas.find(t => t.id === event.active.id) ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTarefa(null)
    const { active, over } = event
    if (!over) return
    const novoStatus = over.id as string
    if (!colunas.find(c => c.key === novoStatus)) return
    const tarefa = tarefas.find(t => t.id === active.id)
    if (!tarefa || tarefa.status === novoStatus) return

    setTarefas(prev => prev.map(t => t.id === active.id ? { ...t, status: novoStatus } : t))

    const supabase = createClient()
    const { error } = await (supabase as any).from('tarefas').update({ status: novoStatus }).eq('id', active.id)
    if (error) setTarefas(prev => prev.map(t => t.id === active.id ? { ...t, status: tarefa.status } : t))
  }

  // ── Criar ──────────────────────────────────────────────────────────────────
  async function criarTarefa() {
    if (!form.titulo.trim()) return
    setSalvando(true)
    const supabase = createClient()
    const { data, error } = await (supabase as any)
      .from('tarefas')
      .insert({
        titulo: form.titulo.trim(),
        projeto_id: form.projeto_id && form.projeto_id !== 'none' ? form.projeto_id : null,
        prioridade: form.prioridade,
        data_vencimento: form.data_vencimento || null,
        descricao: form.descricao.trim() || null,
        status: 'a_fazer',
      })
      .select(SELECT_QUERY)
      .single()
    setSalvando(false)
    if (!error && data) {
      setTarefas(prev => [...prev, data as Tarefa])
      setOpenNova(false)
      setForm(formVazio)
    }
  }

  // ── Editar ─────────────────────────────────────────────────────────────────
  function abrirEditar(tarefa: Tarefa) {
    const proj = projetosOpcoes.find(p => p.nome === tarefa.projetos?.nome)
    setTarefaEditando(tarefa)
    setFormEdit({
      titulo: tarefa.titulo,
      projeto_id: proj?.id ?? '',
      prioridade: tarefa.prioridade,
      data_vencimento: tarefa.data_vencimento ?? '',
      descricao: tarefa.descricao ?? '',
    })
  }

  async function salvarEdicao() {
    if (!tarefaEditando || !formEdit.titulo.trim()) return
    setSalvandoEdit(true)
    const supabase = createClient()
    const { data, error } = await (supabase as any)
      .from('tarefas')
      .update({
        titulo: formEdit.titulo.trim(),
        projeto_id: formEdit.projeto_id && formEdit.projeto_id !== 'none' ? formEdit.projeto_id : null,
        prioridade: formEdit.prioridade,
        data_vencimento: formEdit.data_vencimento || null,
        descricao: formEdit.descricao.trim() || null,
      })
      .eq('id', tarefaEditando.id)
      .select(SELECT_QUERY)
      .single()
    setSalvandoEdit(false)
    if (!error && data) {
      setTarefas(prev => prev.map(t => t.id === tarefaEditando.id ? data as Tarefa : t))
      setTarefaEditando(null)
    }
  }

  async function excluirTarefa(id: string) {
    const supabase = createClient()
    const { error } = await (supabase as any).from('tarefas').delete().eq('id', id)
    if (!error) {
      setTarefas(prev => prev.filter(t => t.id !== id))
      setTarefaEditando(null)
    }
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  const nomesProjetosUsados = Array.from(new Set(tarefas.map(t => t.projetos?.nome).filter(Boolean))) as string[]

  const tarefasFiltradas = tarefas.filter(t =>
    t.titulo.toLowerCase().includes(busca.toLowerCase()) &&
    (filtroProj === 'todos' || t.projetos?.nome === filtroProj) &&
    (filtroPrio === 'todas' || t.prioridade === filtroPrio)
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Tarefas" description="Kanban de todas as tarefas" />

      <main className="flex-1 p-6">
        <PageHeader title="Tarefas">
          <Dialog open={openNova} onOpenChange={setOpenNova}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" />Nova Tarefa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
              <TarefaFormFields
                form={form}
                onChange={patch => setForm(f => ({ ...f, ...patch }))}
                projetos={projetosOpcoes}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenNova(false)}>Cancelar</Button>
                <Button onClick={criarTarefa} disabled={!form.titulo.trim() || salvando}>
                  {salvando ? 'Criando...' : 'Criar Tarefa'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PageHeader>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
            <Input className="pl-9" placeholder="Buscar tarefa..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <Select value={filtroProj} onValueChange={setFiltroProj}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os projetos</SelectItem>
              {nomesProjetosUsados.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroPrio} onValueChange={setFiltroPrio}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Prioridade" /></SelectTrigger>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {colunas.map(col => {
                const tarefasCol = tarefasFiltradas.filter(t => t.status === col.key)
                return (
                  <div key={col.key} className={cn('rounded-xl border-t-2 bg-brand-noite/30', col.cor)}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                      <h3 className="text-sm font-semibold text-brand-lavanda">{col.label}</h3>
                      <span className="text-xs text-brand-lavanda/50 bg-brand-noite/60 rounded-full px-2 py-0.5">
                        {tarefasCol.length}
                      </span>
                    </div>
                    <DroppableColuna id={col.key}>
                      {tarefasCol.length === 0 && (
                        <div className="flex items-center justify-center py-8 text-brand-lavanda/20">
                          <p className="text-xs">Nenhuma tarefa</p>
                        </div>
                      )}
                      {tarefasCol.map(tarefa => (
                        <DraggableCard key={tarefa.id} tarefa={tarefa} onEdit={abrirEditar} />
                      ))}
                      <button
                        onClick={() => setOpenNova(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 hover:bg-white/[0.04] transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar tarefa
                      </button>
                    </DroppableColuna>
                  </div>
                )
              })}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeTarefa ? <GhostCard tarefa={activeTarefa} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      {/* Dialog de edição */}
      <Dialog open={!!tarefaEditando} onOpenChange={open => { if (!open) setTarefaEditando(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Tarefa</DialogTitle></DialogHeader>
          <TarefaFormFields
            form={formEdit}
            onChange={patch => setFormEdit(f => ({ ...f, ...patch }))}
            projetos={projetosOpcoes}
          />
          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <Button
              variant="ghost"
              className="text-brand-rosa hover:text-brand-rosa hover:bg-brand-rosa/10"
              onClick={() => tarefaEditando && excluirTarefa(tarefaEditando.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTarefaEditando(null)}>Cancelar</Button>
              <Button onClick={salvarEdicao} disabled={!formEdit.titulo.trim() || salvandoEdit}>
                {salvandoEdit ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

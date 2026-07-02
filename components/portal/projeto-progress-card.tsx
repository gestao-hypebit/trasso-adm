import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'

type Tarefa = { id: string; titulo: string; status: string; ordem: number }
export type ProjetoCardData = {
  id: string; nome: string; descricao: string | null; status: string
  progresso: number; data_entrega: string | null; data_conclusao: string | null
  tarefas: Tarefa[]
}

const STATUS_CONFIG = {
  backlog:            { label: 'Backlog',           variant: 'outline' as const },
  em_andamento:       { label: 'Em Andamento',       variant: 'default' as const },
  aguardando_cliente: { label: 'Aguardando você',    variant: 'pendente' as const },
  em_revisao:         { label: 'Em Revisão',         variant: 'pendente' as const },
  concluido:          { label: 'Concluído',          variant: 'concluido' as const },
}

export function ProjetoProgressCard({ projeto }: { projeto: ProjetoCardData }) {
  const sc = STATUS_CONFIG[projeto.status as keyof typeof STATUS_CONFIG]
  const tarefas = [...projeto.tarefas].sort((a, b) => a.ordem - b.ordem)

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {sc && <Badge variant={sc.variant}>{sc.label}</Badge>}
            </div>
            <h3 className="text-lg font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{projeto.nome}</h3>
            {projeto.descricao && <p className="text-sm text-brand-lavanda/60 mt-1">{projeto.descricao}</p>}
          </div>
          {projeto.data_entrega && (
            <div className="text-right shrink-0">
              <p className="text-xs text-brand-lavanda/40 flex items-center gap-1 justify-end"><Clock className="h-3 w-3" /> Entrega prevista</p>
              <p className="text-sm text-brand-lavanda font-medium">{formatDate(projeto.data_entrega)}</p>
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-brand-lavanda/50 mb-1.5">
            <span>Progresso</span>
            <span className="font-semibold text-brand-lavanda">{projeto.progresso}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-violeta to-brand-lima" style={{ width: `${projeto.progresso}%` }} />
          </div>
        </div>

        {tarefas.length > 0 && (
          <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
            {tarefas.map((t) => {
              const concluida = t.status === 'concluida'
              return (
                <div key={t.id} className="flex items-center gap-2">
                  {concluida ? (
                    <CheckCircle2 className="h-4 w-4 text-brand-lima shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-brand-lavanda/25 shrink-0" />
                  )}
                  <span className={cn('text-sm', concluida ? 'text-brand-lavanda/40 line-through' : 'text-brand-lavanda/80')}>{t.titulo}</span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Entregas de projeto que o cliente aprova (ou pede ajustes) pelo portal.

export type EntregaEvento = {
  id: string
  tipo: 'enviada' | 'ajustes' | 'aprovada'
  rodada: number
  autor: 'cliente' | 'agencia'
  nome: string | null
  comentario: string | null
  link: string | null
  created_at: string
}

export type Entrega = {
  id: string
  projeto_id: string
  titulo: string
  tipo: 'layout' | 'versao_teste' | 'entrega_final' | 'outro'
  descricao: string | null
  link: string | null
  status: 'aguardando' | 'ajustes' | 'aprovada'
  rodada: number
  enviada_em: string
  aprovada_em: string | null
  aprovada_nome: string | null
  entrega_eventos: EntregaEvento[]
}

export const ENTREGA_SELECT =
  'id, projeto_id, titulo, tipo, descricao, link, status, rodada, enviada_em, aprovada_em, aprovada_nome, entrega_eventos(id, tipo, rodada, autor, nome, comentario, link, created_at)'

export const entregaTipoOpcoes = [
  { value: 'layout', label: 'Layout' },
  { value: 'versao_teste', label: 'Versão de teste' },
  { value: 'entrega_final', label: 'Entrega final' },
  { value: 'outro', label: 'Outro' },
] as const

export const labelEntregaTipo = (v: string) => entregaTipoOpcoes.find((o) => o.value === v)?.label ?? v

export const entregaStatusConfig = {
  aguardando: { label: 'Aguardando aprovação', variant: 'pendente' as const },
  ajustes:    { label: 'Ajustes pedidos',      variant: 'recusada' as const },
  aprovada:   { label: 'Aprovada',             variant: 'aprovada' as const },
}

export const eventoLabel = { enviada: 'Versão enviada', ajustes: 'Ajustes pedidos', aprovada: 'Aprovada' } as const

// Rodadas de ajuste já pedidas em todo o projeto (para comparar com o que foi contratado).
export const ajustesPedidos = (entregas: Pick<Entrega, 'entrega_eventos'>[]) =>
  entregas.reduce((s, e) => s + e.entrega_eventos.filter((ev) => ev.tipo === 'ajustes').length, 0)

export const ordenarEventos = (eventos: EntregaEvento[]) => [...eventos].sort((a, b) => a.created_at.localeCompare(b.created_at))

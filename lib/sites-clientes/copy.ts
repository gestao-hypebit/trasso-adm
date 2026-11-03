// Copy do site para aprovação do cliente, seção por seção.
// Código puro: usado no administrativo, no portal e nas server actions.

export type CopyCampo = { _id: string; rotulo: string; texto: string }

export type CopyStatus = 'rascunho' | 'aguardando' | 'ajustes' | 'aprovada'

export type CopySecao = {
  id: string
  site_id: string
  ordem: number
  titulo: string
  observacao: string | null
  campos: CopyCampo[]
  status: CopyStatus
  rodada: number
  comentario_cliente: string | null
  respondido_em: string | null
  respondido_nome: string | null
  updated_at: string
}

export type CopyEvento = {
  id: string
  secao_id: string | null
  rodada: number
  tipo: 'enviada' | 'aprovada' | 'ajustes' | 'reaberta'
  comentario: string | null
  autor: string | null
  created_at: string
}

export const COPY_SECAO_SELECT = 'id, site_id, ordem, titulo, observacao, campos, status, rodada, comentario_cliente, respondido_em, respondido_nome, updated_at'

export const copyStatusConfig: Record<CopyStatus, { label: string; labelCliente: string; variant: 'default' | 'pendente' | 'urgente' | 'aprovada' | 'inativo' }> = {
  rascunho:   { label: 'Rascunho',          labelCliente: '',                  variant: 'inativo' },
  aguardando: { label: 'Com o cliente',     labelCliente: 'Para você revisar', variant: 'pendente' },
  ajustes:    { label: 'Pediu ajuste',      labelCliente: 'Em ajuste pela Slick', variant: 'urgente' },
  aprovada:   { label: 'Aprovada',          labelCliente: 'Aprovada',          variant: 'aprovada' },
}

export function novoCampoCopy(rotulo = ''): CopyCampo {
  return { _id: Math.random().toString(36).slice(2, 10), rotulo, texto: '' }
}

// Seções mais comuns de um site institucional, para começar rápido.
export const SECOES_SUGERIDAS: { titulo: string; campos: string[] }[] = [
  { titulo: 'Topo', campos: ['Título', 'Texto', 'Botão'] },
  { titulo: 'Sobre', campos: ['Título', 'Texto'] },
  { titulo: 'Serviços', campos: ['Título', 'Serviço 1', 'Serviço 2', 'Serviço 3'] },
  { titulo: 'Diferenciais', campos: ['Título', 'Texto'] },
  { titulo: 'Depoimentos', campos: ['Título', 'Depoimento 1', 'Depoimento 2'] },
  { titulo: 'Perguntas frequentes', campos: ['Pergunta 1', 'Pergunta 2', 'Pergunta 3'] },
  { titulo: 'Contato', campos: ['Título', 'Texto', 'Botão'] },
]

export function secaoTemConteudo(s: Pick<CopySecao, 'campos'>) {
  return (s.campos ?? []).some((c) => c.texto.trim())
}

export function resumoCopy(secoes: Pick<CopySecao, 'status'>[]) {
  const visiveis = secoes.filter((s) => s.status !== 'rascunho')
  return {
    total: secoes.length,
    enviadas: visiveis.length,
    aprovadas: secoes.filter((s) => s.status === 'aprovada').length,
    aguardando: secoes.filter((s) => s.status === 'aguardando').length,
    ajustes: secoes.filter((s) => s.status === 'ajustes').length,
    paraEnviar: secoes.filter((s) => s.status === 'rascunho' || s.status === 'ajustes').length,
  }
}

// Texto da copy em formato simples, para colar no código ou num documento.
export function copyComoTexto(secoes: Pick<CopySecao, 'titulo' | 'campos'>[]) {
  return secoes
    .map((s) => [`## ${s.titulo}`, ...s.campos.filter((c) => c.texto.trim()).map((c) => `${c.rotulo ? `${c.rotulo}: ` : ''}${c.texto.trim()}`)].join('\n\n'))
    .join('\n\n\n')
}

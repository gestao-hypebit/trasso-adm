import type { SupabaseClient } from '@supabase/supabase-js'

// Cria uma cópia em rascunho da proposta (com itens) e devolve o id da nova.
export async function duplicarProposta(supabase: SupabaseClient, propostaId: string): Promise<string> {
  const db = supabase as any
  const { data: original, error } = await db.from('propostas').select('*, proposta_itens(*)').eq('id', propostaId).single()
  if (error || !original) throw error ?? new Error('Proposta não encontrada')

  const ano = new Date().getFullYear()
  const base = `TRS-${ano}-`
  const { data: existentes } = await db.from('propostas').select('numero').like('numero', `${base}%`)
  const usados = new Set(((existentes ?? []) as { numero: string }[]).map((p) => p.numero))
  let n = usados.size + 1
  while (usados.has(`${base}${String(n).padStart(3, '0')}`)) n++

  const { data: nova, error: errNova } = await db.from('propostas').insert({
    numero: `${base}${String(n).padStart(3, '0')}`,
    cliente_id: original.cliente_id,
    titulo: `${original.titulo} (cópia)`,
    descricao: original.descricao,
    status: 'rascunho',
    validade: original.validade,
    valor_total: original.valor_total,
    desconto_percentual: original.desconto_percentual,
    condicoes_pagamento: original.condicoes_pagamento,
    observacoes: original.observacoes,
    responsavel_id: original.responsavel_id,
  }).select('id').single()
  if (errNova) throw errNova

  const itens = (original.proposta_itens ?? []) as Record<string, unknown>[]
  if (itens.length > 0) {
    const { error: errItens } = await db.from('proposta_itens').insert(
      itens.map(({ id: _id, proposta_id: _p, valor_total: _v, ...resto }) => ({ ...resto, proposta_id: nova.id }))
    )
    if (errItens) throw errItens
  }
  return nova.id
}

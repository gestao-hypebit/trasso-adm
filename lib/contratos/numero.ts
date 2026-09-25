import type { SupabaseClient } from '@supabase/supabase-js'

// Reserva o próximo número livre no formato PREFIXO-AAAA-NNN (ex: CONT-2026-004),
// respeitando prefixo e "próximo número" de Configurações e pulando números já usados.
export async function proximoNumeroContrato(supabase: SupabaseClient): Promise<string> {
  const db = supabase as any
  const ano = new Date().getFullYear()
  const { data: cfg } = await db.from('configuracoes_agencia').select('id, contrato_prefixo, contrato_contador').limit(1).maybeSingle()
  const prefixo = cfg?.contrato_prefixo || 'CONT'
  const base = `${prefixo}-${ano}-`

  const { data } = await db.from('contratos').select('numero').like('numero', `${base}%`)
  const usados = new Set(((data ?? []) as { numero: string }[]).map((c) => c.numero))
  let n = Math.max(1, Number(cfg?.contrato_contador) || 1)
  while (usados.has(`${base}${String(n).padStart(3, '0')}`)) n++

  if (cfg?.id) await db.from('configuracoes_agencia').update({ contrato_contador: n + 1 }).eq('id', cfg.id)
  return `${base}${String(n).padStart(3, '0')}`
}

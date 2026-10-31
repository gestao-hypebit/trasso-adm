import 'server-only'
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { isModelo, perguntasDoBriefing, type ModeloBriefing, type StatusBriefing } from '@/lib/social/briefing'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Planejamento aberto pelo link do cliente (/plano/<token>). Link desligado = não existe.
export const getPlanejamentoPorToken = cache(async (token: string) => {
  if (!UUID_RE.test(token)) return null
  const supabase = createServiceClient() as any
  const { data } = await supabase
    .from('social_planejamentos')
    .select('id, mes, data_fim, objetivo, status, link_ativo, clientes(nome, empresa)')
    .eq('token', token)
    .maybeSingle()
  if (!data || !data.link_ativo) return null
  return {
    id: data.id as string,
    mes: data.mes as string,
    fim: data.data_fim as string | null,
    objetivo: data.objetivo as string | null,
    status: data.status as string,
    clienteNome: (data.clientes?.empresa || data.clientes?.nome || 'Cliente') as string,
    contatoNome: (data.clientes?.nome ?? '') as string,
  }
})

// Briefing aberto pelo link do cliente (/briefing/<token>). Só o que o formulário precisa.
export const getBriefingPorToken = cache(async (token: string) => {
  if (!UUID_RE.test(token)) return null
  const supabase = createServiceClient() as any
  const { data } = await supabase
    .from('social_briefings')
    // `*` e não a lista de colunas: projeto_id e perguntas só existem depois das migrations de 2026-11.
    .select('*, clientes(nome, empresa)')
    .eq('token', token)
    .maybeSingle()
  if (!data || !isModelo(data.modelo)) return null
  return {
    id: data.id as string,
    modelo: data.modelo as ModeloBriefing,
    status: data.status as StatusBriefing,
    projetoId: (data.projeto_id ?? null) as string | null,
    perguntas: perguntasDoBriefing({ modelo: data.modelo, perguntas: data.perguntas }),
    clienteNome: (data.clientes?.empresa || data.clientes?.nome || 'Cliente') as string,
    contatoNome: (data.clientes?.nome ?? '') as string,
  }
})

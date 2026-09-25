'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getClienteByToken } from '@/lib/portal/auth'
import { createServiceClient } from '@/lib/supabase/service'

export type PortalActionResult = { success: true } | { success: false; error: string }

const ERRO_GENERICO = 'Ocorreu um erro. Tente novamente.'
const ERRO_LINK = 'Link inválido ou expirado.'

async function clienteFromToken(token: string) {
  return getClienteByToken(token)
}

// Aviso interno (sino do header). Nunca deve derrubar a ação do cliente.
async function notificar(supabase: any, titulo: string, mensagem: string, link: string, tipo = 'sucesso') {
  try {
    await supabase.from('notificacoes').insert({ usuario_id: null, titulo, mensagem, link, tipo, lida: false })
  } catch (e) {
    console.error('[portal] notificar', e)
  }
}

async function ipEUserAgent() {
  const h = await headers()
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  }
}

export async function aprovarProposta(token: string, propostaId: string): Promise<PortalActionResult> {
  try {
    const cliente = await clienteFromToken(token)
    if (!cliente) return { success: false, error: ERRO_LINK }

    const supabase = createServiceClient() as any
    const { data: proposta } = await supabase.from('propostas').select('id, numero, cliente_id, status').eq('id', propostaId).maybeSingle()
    if (!proposta || proposta.cliente_id !== cliente.id) return { success: false, error: ERRO_LINK }

    if (proposta.status === 'aprovada') return { success: true }
    if (!['enviada', 'em_negociacao'].includes(proposta.status)) {
      return { success: false, error: 'Esta proposta não pode mais ser aprovada.' }
    }

    const { ip, userAgent } = await ipEUserAgent()
    const { error } = await supabase
      .from('propostas')
      .update({ status: 'aprovada', aprovada_em: new Date().toISOString(), aprovada_ip: ip, aprovada_user_agent: userAgent })
      .eq('id', propostaId)
    if (error) throw error
    await notificar(supabase, 'Proposta aprovada 🎉', `${cliente.nome} aprovou a proposta ${proposta.numero} pelo portal.`, `/propostas/${propostaId}`)

    revalidatePath(`/portal/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[portal] aprovarProposta', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

export async function recusarProposta(token: string, propostaId: string): Promise<PortalActionResult> {
  try {
    const cliente = await clienteFromToken(token)
    if (!cliente) return { success: false, error: ERRO_LINK }

    const supabase = createServiceClient() as any
    const { data: proposta } = await supabase.from('propostas').select('id, numero, cliente_id, status').eq('id', propostaId).maybeSingle()
    if (!proposta || proposta.cliente_id !== cliente.id) return { success: false, error: ERRO_LINK }

    if (proposta.status === 'recusada') return { success: true }
    if (!['enviada', 'em_negociacao'].includes(proposta.status)) {
      return { success: false, error: 'Esta proposta não pode mais ser recusada.' }
    }

    const { error } = await supabase.from('propostas').update({ status: 'recusada' }).eq('id', propostaId)
    if (error) throw error
    await notificar(supabase, 'Proposta recusada', `${cliente.nome} recusou a proposta ${proposta.numero} pelo portal.`, `/propostas/${propostaId}`, 'alerta')

    revalidatePath(`/portal/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[portal] recusarProposta', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

export async function assinarContrato(token: string, contratoId: string, nomeConfirmacao: string): Promise<PortalActionResult> {
  try {
    const nome = nomeConfirmacao.trim()
    if (nome.length < 3) return { success: false, error: 'Informe seu nome completo.' }

    const cliente = await clienteFromToken(token)
    if (!cliente) return { success: false, error: ERRO_LINK }

    const supabase = createServiceClient() as any
    const { data: contrato } = await supabase.from('contratos').select('id, numero, cliente_id, status').eq('id', contratoId).maybeSingle()
    if (!contrato || contrato.cliente_id !== cliente.id) return { success: false, error: ERRO_LINK }

    if (contrato.status === 'assinado') return { success: true }
    if (contrato.status !== 'enviado') {
      return { success: false, error: 'Este contrato não está disponível para assinatura.' }
    }

    const { ip, userAgent } = await ipEUserAgent()
    const { error } = await supabase
      .from('contratos')
      .update({
        status: 'assinado',
        assinado_em: new Date().toISOString(),
        assinado_nome: nome,
        assinado_ip: ip,
        assinado_user_agent: userAgent,
      })
      .eq('id', contratoId)
    if (error) throw error
    await notificar(supabase, 'Contrato assinado ✍️', `${nome} assinou o contrato ${contrato.numero} pelo portal.`, `/contratos/${contratoId}`)

    revalidatePath(`/portal/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[portal] assinarContrato', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

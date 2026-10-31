'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getBriefingPorToken } from '@/lib/social/publico'
import { errosDoBriefing, limparRespostas } from '@/lib/social/briefing'
import { TITULO_ITEM_BRIEFING } from '@/lib/projetos/onboarding'

export type EnvioResult = { success: true } | { success: false; error: string; erros?: Record<string, string> }

const ERRO_GENERICO = 'Não conseguimos enviar agora. Tente de novo em instantes.'

// Grava as respostas do briefing daquele token. Só aceita as perguntas do modelo
// e só enquanto o briefing ainda não foi respondido.
export async function enviarBriefing(token: string, bruto: unknown): Promise<EnvioResult> {
  try {
    const briefing = await getBriefingPorToken(token)
    if (!briefing) return { success: false, error: 'Link não encontrado.' }
    if (briefing.status === 'respondido') return { success: true }

    const respostas = limparRespostas(briefing.modelo, bruto)
    const erros = errosDoBriefing(briefing.modelo, respostas)
    if (Object.keys(erros).length) return { success: false, error: 'Faltam algumas respostas.', erros }

    const supabase = createServiceClient() as any
    const agora = new Date().toISOString()
    const { error } = await supabase.from('social_briefings')
      .update({ respostas, status: 'respondido', respondido_em: agora })
      .eq('id', briefing.id)
      .eq('status', 'enviado')
    if (error) throw error

    if (briefing.projetoId) await avisarProjeto(supabase, briefing.projetoId, briefing.clienteNome, agora)

    revalidatePath(`/briefing/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[briefing] enviarBriefing', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

// Briefing de projeto respondido: marca o item do onboarding e avisa no sino.
// Nada aqui pode derrubar o envio do cliente, que já foi gravado.
async function avisarProjeto(supabase: any, projetoId: string, cliente: string, agora: string) {
  try {
    const { data: projeto } = await supabase.from('projetos').select('nome').eq('id', projetoId).maybeSingle()
    await supabase
      .from('onboarding_itens')
      .update({ concluido: true, concluido_em: agora, concluido_por: 'cliente' })
      .eq('projeto_id', projetoId)
      .eq('titulo', TITULO_ITEM_BRIEFING)
      .eq('concluido', false)
    await notificar(supabase, 'Briefing respondido 📋', `${cliente} respondeu o briefing${projeto?.nome ? ` de ${projeto.nome}` : ''}.`, `/projetos/${projetoId}?aba=briefing`)
  } catch (e) {
    console.error('[briefing] avisarProjeto', e)
  }
}

async function notificar(supabase: any, titulo: string, mensagem: string, link: string) {
  try {
    await supabase.from('notificacoes').insert({ usuario_id: null, titulo, mensagem, link, tipo: 'sucesso', lida: false })
  } catch (e) {
    console.error('[briefing] notificar', e)
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getBriefingPorToken } from '@/lib/social/publico'
import { errosDoBriefing, limparRespostas } from '@/lib/social/briefing'

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
    const { error } = await supabase.from('social_briefings')
      .update({ respostas, status: 'respondido', respondido_em: new Date().toISOString() })
      .eq('id', briefing.id)
      .eq('status', 'enviado')
    if (error) throw error

    revalidatePath(`/briefing/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[briefing] enviarBriefing', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanejamentoPorToken } from '@/lib/social/publico'
import { statusPelosPosts } from '@/lib/social/tipos'

export type RespostaResult = { success: true } | { success: false; error: string }

const ERRO_GENERICO = 'Ocorreu um erro. Tente novamente.'
const ERRO_LINK = 'Link inválido ou expirado.'
const ERRO_RASCUNHO = 'Este planejamento ainda não foi enviado para aprovação.'

// Depois de cada resposta, o status do planejamento acompanha os posts.
async function atualizarStatus(supabase: any, planejamento: { id: string; status: string }) {
  const { data: posts } = await supabase.from('social_posts').select('aprovacao').eq('planejamento_id', planejamento.id)
  const status = statusPelosPosts(posts ?? [], planejamento.status)
  const agora = new Date().toISOString()
  await supabase.from('social_planejamentos')
    .update({ status, aprovado_em: status === 'aprovado' ? agora : null, updated_at: agora })
    .eq('id', planejamento.id)
  return status
}

async function notificar(supabase: any, titulo: string, mensagem: string, link: string, tipo: string) {
  try {
    await supabase.from('notificacoes').insert({ usuario_id: null, titulo, mensagem, link, tipo, lida: false })
  } catch (e) {
    console.error('[plano] notificar', e)
  }
}

function limpar(nome: string, comentario: string) {
  return { nome: nome.trim().slice(0, 200), comentario: comentario.trim().slice(0, 5000) }
}

export async function responderPost(
  token: string,
  postId: string,
  resposta: { aprovar: boolean; nome: string; comentario: string },
): Promise<RespostaResult> {
  try {
    const { nome, comentario } = limpar(resposta.nome, resposta.comentario)
    if (nome.length < 2) return { success: false, error: 'Informe seu nome.' }
    if (!resposta.aprovar && !comentario) return { success: false, error: 'Conte o que precisa ser ajustado.' }

    const plano = await getPlanejamentoPorToken(token)
    if (!plano) return { success: false, error: ERRO_LINK }
    if (plano.status === 'rascunho') return { success: false, error: ERRO_RASCUNHO }

    const supabase = createServiceClient() as any
    const { data: post } = await supabase.from('social_posts').select('id, titulo, planejamento_id').eq('id', postId).maybeSingle()
    if (!post || post.planejamento_id !== plano.id) return { success: false, error: ERRO_LINK }

    const { error } = await supabase.from('social_posts').update({
      aprovacao: resposta.aprovar ? 'aprovado' : 'ajustes',
      comentario_cliente: comentario || null,
      respondido_nome: nome,
      respondido_em: new Date().toISOString(),
    }).eq('id', postId)
    if (error) throw error

    const status = await atualizarStatus(supabase, plano)
    if (!resposta.aprovar) {
      await notificar(supabase, 'Ajuste pedido no planejamento', `${nome} pediu ajuste em "${post.titulo}" (${plano.clienteNome}).`, `/social/${plano.id}`, 'alerta')
    } else if (status === 'aprovado') {
      await notificar(supabase, 'Planejamento aprovado ✅', `${nome} aprovou todos os posts de ${plano.clienteNome}.`, `/social/${plano.id}`, 'sucesso')
    }

    revalidatePath(`/plano/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[plano] responderPost', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

// "Aprovar tudo": aprova os posts que ainda aguardam (não mexe nos que pediram ajuste).
export async function aprovarPendentes(token: string, nomeBruto: string): Promise<RespostaResult> {
  try {
    const { nome } = limpar(nomeBruto, '')
    if (nome.length < 2) return { success: false, error: 'Informe seu nome.' }

    const plano = await getPlanejamentoPorToken(token)
    if (!plano) return { success: false, error: ERRO_LINK }
    if (plano.status === 'rascunho') return { success: false, error: ERRO_RASCUNHO }

    const supabase = createServiceClient() as any
    const { error } = await supabase.from('social_posts')
      .update({ aprovacao: 'aprovado', respondido_nome: nome, respondido_em: new Date().toISOString() })
      .eq('planejamento_id', plano.id)
      .eq('aprovacao', 'pendente')
    if (error) throw error

    const status = await atualizarStatus(supabase, plano)
    await notificar(
      supabase,
      status === 'aprovado' ? 'Planejamento aprovado ✅' : 'Posts aprovados',
      status === 'aprovado' ? `${nome} aprovou todos os posts de ${plano.clienteNome}.` : `${nome} aprovou os posts pendentes de ${plano.clienteNome} (há ajustes pedidos).`,
      `/social/${plano.id}`,
      'sucesso',
    )

    revalidatePath(`/plano/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[plano] aprovarPendentes', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

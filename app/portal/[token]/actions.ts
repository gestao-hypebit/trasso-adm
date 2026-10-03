'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getClienteByToken } from '@/lib/portal/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { TITULO_ITEM_BRIEFING } from '@/lib/projetos/onboarding'

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

// O registro pertence a um projeto deste cliente?
async function projetoDoCliente(supabase: any, projetoId: string, clienteId: string) {
  const { data } = await supabase.from('projetos').select('id, nome, cliente_id').eq('id', projetoId).maybeSingle()
  return data && data.cliente_id === clienteId ? (data as { id: string; nome: string }) : null
}

export async function salvarBriefing(
  token: string,
  briefingId: string,
  respostas: Record<string, string>,
  enviar: boolean,
): Promise<PortalActionResult> {
  try {
    const cliente = await clienteFromToken(token)
    if (!cliente) return { success: false, error: ERRO_LINK }

    const supabase = createServiceClient() as any
    const { data: briefing } = await supabase.from('briefings').select('id, projeto_id, perguntas, status').eq('id', briefingId).maybeSingle()
    if (!briefing) return { success: false, error: ERRO_LINK }
    const projeto = await projetoDoCliente(supabase, briefing.projeto_id, cliente.id)
    if (!projeto) return { success: false, error: ERRO_LINK }

    // Só guarda as perguntas que existem, com tamanho limitado.
    const perguntas = (briefing.perguntas ?? []) as { chave: string; rotulo: string; obrigatorio: boolean }[]
    const limpas: Record<string, string> = {}
    for (const p of perguntas) {
      const v = String(respostas[p.chave] ?? '').trim().slice(0, 5000)
      if (v) limpas[p.chave] = v
    }
    if (enviar) {
      const faltando = perguntas.find((p) => p.obrigatorio && !limpas[p.chave])
      if (faltando) return { success: false, error: `Responda: "${faltando.rotulo}"` }
    }

    const agora = new Date().toISOString()
    const { error } = await supabase
      .from('briefings')
      .update({
        respostas: limpas,
        updated_at: agora,
        ...(enviar ? { status: 'respondido', respondido_em: agora } : {}),
      })
      .eq('id', briefingId)
    if (error) throw error

    if (enviar && briefing.status !== 'respondido') {
      await supabase
        .from('onboarding_itens')
        .update({ concluido: true, concluido_em: agora, concluido_por: 'cliente' })
        .eq('projeto_id', projeto.id)
        .eq('titulo', TITULO_ITEM_BRIEFING)
        .eq('concluido', false)
      await notificar(supabase, 'Briefing respondido 📋', `${cliente.nome} respondeu o briefing de ${projeto.nome}.`, `/projetos/${projeto.id}`)
    }

    revalidatePath(`/portal/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[portal] salvarBriefing', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

export async function marcarItemOnboarding(token: string, itemId: string, concluido: boolean): Promise<PortalActionResult> {
  try {
    const cliente = await clienteFromToken(token)
    if (!cliente) return { success: false, error: ERRO_LINK }

    const supabase = createServiceClient() as any
    const { data: item } = await supabase.from('onboarding_itens').select('id, projeto_id, responsavel, titulo').eq('id', itemId).maybeSingle()
    if (!item || item.responsavel !== 'cliente') return { success: false, error: ERRO_LINK }
    const projeto = await projetoDoCliente(supabase, item.projeto_id, cliente.id)
    if (!projeto) return { success: false, error: ERRO_LINK }

    const { error } = await supabase
      .from('onboarding_itens')
      .update({ concluido, concluido_em: concluido ? new Date().toISOString() : null, concluido_por: concluido ? 'cliente' : null })
      .eq('id', itemId)
    if (error) throw error
    if (concluido) {
      await notificar(supabase, 'Onboarding', `${cliente.nome} marcou "${item.titulo}" como feito em ${projeto.nome}.`, `/projetos/${projeto.id}`, 'info')
    }

    revalidatePath(`/portal/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[portal] marcarItemOnboarding', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

export async function responderEntrega(
  token: string,
  entregaId: string,
  resposta: { aprovar: boolean; nome: string; comentario: string },
): Promise<PortalActionResult> {
  try {
    const nome = resposta.nome.trim().slice(0, 200)
    const comentario = resposta.comentario.trim().slice(0, 5000)
    if (nome.length < 3) return { success: false, error: 'Informe seu nome.' }
    if (!resposta.aprovar && !comentario) return { success: false, error: 'Conte o que precisa ser ajustado.' }

    const cliente = await clienteFromToken(token)
    if (!cliente) return { success: false, error: ERRO_LINK }

    const supabase = createServiceClient() as any
    const { data: entrega } = await supabase.from('entregas').select('id, projeto_id, titulo, status, rodada').eq('id', entregaId).maybeSingle()
    if (!entrega) return { success: false, error: ERRO_LINK }
    const projeto = await projetoDoCliente(supabase, entrega.projeto_id, cliente.id)
    if (!projeto) return { success: false, error: ERRO_LINK }
    if (entrega.status !== 'aguardando') return { success: false, error: 'Esta entrega já foi respondida.' }

    const { ip, userAgent } = await ipEUserAgent()
    const agora = new Date().toISOString()
    const { data: atualizada, error } = await supabase
      .from('entregas')
      .update(resposta.aprovar
        ? { status: 'aprovada', aprovada_em: agora, aprovada_nome: nome, updated_at: agora }
        : { status: 'ajustes', updated_at: agora })
      .eq('id', entregaId)
      .eq('status', 'aguardando')
      .select('id')
    if (error) throw error
    // Outra resposta chegou antes (ex.: duas abas abertas).
    if (!atualizada?.length) return { success: false, error: 'Esta entrega já foi respondida.' }

    await supabase.from('entrega_eventos').insert({
      entrega_id: entregaId,
      tipo: resposta.aprovar ? 'aprovada' : 'ajustes',
      rodada: entrega.rodada,
      autor: 'cliente',
      nome,
      comentario: comentario || null,
      ip,
      user_agent: userAgent,
    })

    await notificar(
      supabase,
      resposta.aprovar ? 'Entrega aprovada ✅' : 'Cliente pediu ajustes',
      `${nome} ${resposta.aprovar ? 'aprovou' : 'pediu ajustes em'} "${entrega.titulo}" (${projeto.nome}).`,
      `/projetos/${projeto.id}`,
      resposta.aprovar ? 'sucesso' : 'alerta',
    )

    revalidatePath(`/portal/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[portal] responderEntrega', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

export async function responderAvaliacao(
  token: string,
  avaliacaoId: string,
  resposta: { nota: number; comentario: string; depoimento: string; autorizaPublicar: boolean; nomeExibicao: string; cargoEmpresa: string },
): Promise<PortalActionResult> {
  try {
    const nota = Math.round(Number(resposta.nota))
    if (!(nota >= 0 && nota <= 10)) return { success: false, error: 'Escolha uma nota de 0 a 10.' }

    const cliente = await clienteFromToken(token)
    if (!cliente) return { success: false, error: ERRO_LINK }

    const supabase = createServiceClient() as any
    const { data: avaliacao } = await supabase.from('avaliacoes').select('id, cliente_id, status').eq('id', avaliacaoId).maybeSingle()
    if (!avaliacao || avaliacao.cliente_id !== cliente.id) return { success: false, error: ERRO_LINK }
    if (avaliacao.status === 'respondida') return { success: true }

    const depoimento = resposta.depoimento.trim().slice(0, 3000)
    const { error } = await supabase
      .from('avaliacoes')
      .update({
        status: 'respondida',
        respondida_em: new Date().toISOString(),
        nota,
        comentario: resposta.comentario.trim().slice(0, 3000) || null,
        depoimento: depoimento || null,
        autoriza_publicar: !!depoimento && resposta.autorizaPublicar,
        nome_exibicao: resposta.nomeExibicao.trim().slice(0, 200) || null,
        cargo_empresa: resposta.cargoEmpresa.trim().slice(0, 200) || null,
      })
      .eq('id', avaliacaoId)
    if (error) throw error

    await notificar(
      supabase,
      `Nova avaliação: nota ${nota}`,
      `${cliente.nome} avaliou o trabalho${depoimento ? ' e deixou um depoimento' : ''}.`,
      '/avaliacoes',
      nota >= 9 ? 'sucesso' : nota <= 6 ? 'alerta' : 'info',
    )

    revalidatePath(`/portal/${token}`)
    return { success: true }
  } catch (e) {
    console.error('[portal] responderAvaliacao', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

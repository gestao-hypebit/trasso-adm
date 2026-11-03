import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// Respostas do cliente à copy (aprovar / pedir ajuste). Usado pelo portal
// (/portal/<token>) e pelo link só da copy (/copy/<token>): quem chama já
// conferiu que o site pertence a quem está respondendo.

export type SiteCopy = { id: string; nome: string }
export type RespostaCopy = { aprovar: boolean; nome: string; comentario: string }
export type ResultadoCopy = { success: true } | { success: false; error: string }

const ERRO_GENERICO = 'Ocorreu um erro. Tente novamente.'
const ERRO_LINK = 'Link inválido ou expirado.'

// Depois de cada resposta: se não sobrou nada "aguardando", avisa a equipe (sino) com o resumo.
async function avisarSeRevisada(supabase: any, site: SiteCopy, nome: string) {
  try {
    const { data } = await supabase.from('site_copy_secoes').select('status').eq('site_id', site.id)
    const lista = (data ?? []) as { status: string }[]
    if (lista.some((s) => s.status === 'aguardando')) return
    const aprovadas = lista.filter((s) => s.status === 'aprovada').length
    const ajustes = lista.filter((s) => s.status === 'ajustes').length
    await supabase.from('notificacoes').insert({
      usuario_id: null,
      titulo: ajustes ? 'Copy revisada: tem ajustes ✍️' : 'Copy aprovada ✅',
      mensagem: `${nome} revisou a copy de "${site.nome}": ${aprovadas} aprovada${aprovadas === 1 ? '' : 's'}${ajustes ? `, ${ajustes} com ajuste` : ''}.`,
      link: `/sites-clientes/${site.id}/copy`,
      tipo: ajustes ? 'alerta' : 'sucesso',
      lida: false,
    })
  } catch (e) {
    console.error('[copy] notificar', e)
  }
}

export async function responderSecaoCopy(site: SiteCopy, secaoId: string, resposta: RespostaCopy): Promise<ResultadoCopy> {
  try {
    const nome = resposta.nome.trim().slice(0, 200)
    const comentario = resposta.comentario.trim().slice(0, 5000)
    if (nome.length < 3) return { success: false, error: 'Informe seu nome.' }
    if (!resposta.aprovar && !comentario) return { success: false, error: 'Conte o que precisa mudar.' }

    const supabase = createServiceClient() as any
    const { data: secao } = await supabase.from('site_copy_secoes').select('id, site_id, status, rodada').eq('id', secaoId).maybeSingle()
    if (!secao || secao.site_id !== site.id) return { success: false, error: ERRO_LINK }
    if (secao.status !== 'aguardando') return { success: false, error: 'Esta seção já foi respondida.' }

    const agora = new Date().toISOString()
    const { data: atualizada, error } = await supabase
      .from('site_copy_secoes')
      .update({
        status: resposta.aprovar ? 'aprovada' : 'ajustes',
        comentario_cliente: resposta.aprovar ? null : comentario,
        respondido_em: agora,
        respondido_nome: nome,
        updated_at: agora,
      })
      .eq('id', secaoId)
      .eq('status', 'aguardando')
      .select('id')
    if (error) throw error
    // Outra resposta chegou antes (ex.: duas abas abertas).
    if (!atualizada?.length) return { success: false, error: 'Esta seção já foi respondida.' }

    await supabase.from('site_copy_eventos').insert({
      site_id: site.id, secao_id: secaoId, rodada: secao.rodada,
      tipo: resposta.aprovar ? 'aprovada' : 'ajustes',
      comentario: comentario || null, autor: nome,
    })
    await avisarSeRevisada(supabase, site, nome)
    return { success: true }
  } catch (e) {
    console.error('[copy] responder', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

export async function aprovarRestanteCopy(site: SiteCopy, nomeBruto: string): Promise<ResultadoCopy> {
  try {
    const nome = nomeBruto.trim().slice(0, 200)
    if (nome.length < 3) return { success: false, error: 'Informe seu nome.' }

    const supabase = createServiceClient() as any
    const agora = new Date().toISOString()
    const { data: aprovadas, error } = await supabase
      .from('site_copy_secoes')
      .update({ status: 'aprovada', comentario_cliente: null, respondido_em: agora, respondido_nome: nome, updated_at: agora })
      .eq('site_id', site.id)
      .eq('status', 'aguardando')
      .select('id, rodada')
    if (error) throw error
    if (aprovadas?.length) {
      await supabase.from('site_copy_eventos').insert(
        aprovadas.map((s: { id: string; rodada: number }) => ({ site_id: site.id, secao_id: s.id, rodada: s.rodada, tipo: 'aprovada', autor: nome })),
      )
      await avisarSeRevisada(supabase, site, nome)
    }
    return { success: true }
  } catch (e) {
    console.error('[copy] aprovar restante', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

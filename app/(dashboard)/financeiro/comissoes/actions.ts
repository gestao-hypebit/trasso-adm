'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { gerarComissoesDoMes, type GerarComissoesResult } from '@/lib/comissoes/gerar'
import { indicadorSchema, type IndicadorFormData } from '@/lib/validations/indicador'
import { indicacaoSchema, type IndicacaoFormData } from '@/lib/validations/indicacao'

export type ComissaoActionResult =
  | { success: true }
  | { success: false; error: string }

const ERRO_GENERICO = 'Ocorreu um erro. Tente novamente.'

function zodErrorMessage(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? ERRO_GENERICO
  return ERRO_GENERICO
}

export async function gerarComissoesAction(
  competencia: string
): Promise<{ success: true; result: GerarComissoesResult } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const result = await gerarComissoesDoMes(supabase, competencia)
    revalidatePath('/financeiro/comissoes')
    return { success: true, result }
  } catch (e) {
    console.error('[comissoes] gerarComissoesAction', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

export async function marcarComissaoPagaAction(comissaoId: string): Promise<ComissaoActionResult> {
  try {
    const supabase = (await createClient()) as any
    const { data: comissao } = await supabase
      .from('comissoes')
      .select('lancamento_id')
      .eq('id', comissaoId)
      .maybeSingle()
    if (!comissao) return { success: false, error: 'Comissão não encontrada.' }

    const { error } = await supabase.from('lancamentos').update({ status: 'pago' }).eq('id', comissao.lancamento_id)
    if (error) throw error

    revalidatePath('/financeiro/comissoes')
    return { success: true }
  } catch (e) {
    console.error('[comissoes] marcarComissaoPagaAction', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

export async function cancelarComissaoAction(comissaoId: string): Promise<ComissaoActionResult> {
  try {
    const supabase = (await createClient()) as any
    const { data: comissao } = await supabase
      .from('comissoes')
      .select('lancamento_id')
      .eq('id', comissaoId)
      .maybeSingle()
    if (!comissao) return { success: false, error: 'Comissão não encontrada.' }

    const { error } = await supabase.from('lancamentos').update({ status: 'cancelado' }).eq('id', comissao.lancamento_id)
    if (error) throw error

    revalidatePath('/financeiro/comissoes')
    return { success: true }
  } catch (e) {
    console.error('[comissoes] cancelarComissaoAction', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

export async function criarIndicadorAction(data: IndicadorFormData): Promise<ComissaoActionResult> {
  try {
    const parsed = indicadorSchema.parse(data)
    const supabase = (await createClient()) as any
    const { error } = await supabase.from('indicadores').insert({
      tipo: parsed.tipo,
      cliente_id: parsed.cliente_id || null,
      nome: parsed.nome,
      email: parsed.email || null,
      telefone: parsed.telefone || null,
      whatsapp: parsed.whatsapp || null,
      chave_pix: parsed.chave_pix || null,
      observacoes: parsed.observacoes || null,
      ativo: parsed.ativo,
    })
    if (error) throw error

    revalidatePath('/financeiro/comissoes')
    return { success: true }
  } catch (e) {
    console.error('[comissoes] criarIndicadorAction', e)
    return { success: false, error: zodErrorMessage(e) }
  }
}

export async function atualizarIndicadorAction(id: string, data: IndicadorFormData): Promise<ComissaoActionResult> {
  try {
    const parsed = indicadorSchema.parse(data)
    const supabase = (await createClient()) as any
    const { error } = await supabase.from('indicadores').update({
      tipo: parsed.tipo,
      cliente_id: parsed.cliente_id || null,
      nome: parsed.nome,
      email: parsed.email || null,
      telefone: parsed.telefone || null,
      whatsapp: parsed.whatsapp || null,
      chave_pix: parsed.chave_pix || null,
      observacoes: parsed.observacoes || null,
      ativo: parsed.ativo,
    }).eq('id', id)
    if (error) throw error

    revalidatePath('/financeiro/comissoes')
    return { success: true }
  } catch (e) {
    console.error('[comissoes] atualizarIndicadorAction', e)
    return { success: false, error: zodErrorMessage(e) }
  }
}

export async function criarIndicacaoAction(data: IndicacaoFormData): Promise<ComissaoActionResult> {
  try {
    const parsed = indicacaoSchema.parse(data)
    const supabase = (await createClient()) as any

    const { data: ativaExistente } = await supabase
      .from('indicacoes')
      .select('id')
      .eq('cliente_indicado_id', parsed.cliente_indicado_id)
      .eq('status', 'ativa')
      .maybeSingle()
    if (ativaExistente) {
      return { success: false, error: 'Este cliente já possui uma indicação ativa.' }
    }

    const { error } = await supabase.from('indicacoes').insert({
      indicador_id: parsed.indicador_id,
      cliente_indicado_id: parsed.cliente_indicado_id,
      tipo_comissao: parsed.tipo_comissao,
      valor_fixo: parsed.tipo_comissao === 'fixo' ? parsed.valor_fixo : null,
      percentual: parsed.tipo_comissao === 'percentual' ? parsed.percentual : null,
      status: parsed.status,
      data_inicio: parsed.data_inicio,
      data_fim: parsed.data_fim || null,
      observacoes: parsed.observacoes || null,
    })
    if (error) throw error

    revalidatePath('/financeiro/comissoes')
    return { success: true }
  } catch (e) {
    console.error('[comissoes] criarIndicacaoAction', e)
    return { success: false, error: zodErrorMessage(e) }
  }
}

export async function encerrarIndicacaoAction(id: string): Promise<ComissaoActionResult> {
  try {
    const supabase = (await createClient()) as any
    const { error } = await supabase
      .from('indicacoes')
      .update({ status: 'encerrada', data_fim: new Date().toISOString().slice(0, 10) })
      .eq('id', id)
    if (error) throw error

    revalidatePath('/financeiro/comissoes')
    return { success: true }
  } catch (e) {
    console.error('[comissoes] encerrarIndicacaoAction', e)
    return { success: false, error: ERRO_GENERICO }
  }
}

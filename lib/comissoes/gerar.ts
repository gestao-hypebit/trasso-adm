import type { SupabaseClient } from '@supabase/supabase-js'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import type { Database } from '@/types/database.types'

export interface GerarComissoesResult {
  competencia: string
  geradas: number
  ignoradas: number
  erros: { indicacaoId: string; erro: string }[]
}

const CATEGORIA_COMISSAO_NOME = 'Comissão de Indicação'

async function resolveOrCreateCategoriaComissao(db: any): Promise<string> {
  const { data: existente } = await db
    .from('categorias_financeiras')
    .select('id')
    .eq('nome', CATEGORIA_COMISSAO_NOME)
    .eq('tipo', 'despesa')
    .maybeSingle()
  if (existente) return existente.id

  const { data: nova, error } = await db
    .from('categorias_financeiras')
    .insert({ nome: CATEGORIA_COMISSAO_NOME, tipo: 'despesa', cor: '#FF4D8D' })
    .select('id')
    .single()
  if (error || !nova) throw new Error('Não foi possível criar a categoria de comissão.')
  return nova.id
}

/**
 * Gera as comissões de uma competência (mês) para todas as indicações ativas
 * cujo cliente indicado esteja ativo, criando uma despesa em `lancamentos`
 * para cada uma. Idempotente: já não gera de novo se a comissão daquela
 * indicação+competência já existir (também protegido por unique no banco).
 */
export async function gerarComissoesDoMes(
  supabase: SupabaseClient<Database>,
  competencia: Date | string = new Date()
): Promise<GerarComissoesResult> {
  const db = supabase as any
  const refDate = typeof competencia === 'string' ? new Date(competencia) : competencia
  const inicio = startOfMonth(refDate)
  const fim = endOfMonth(refDate)
  const competenciaStr = format(inicio, 'yyyy-MM-dd')
  const inicioStr = format(inicio, 'yyyy-MM-dd')
  const fimStr = format(fim, 'yyyy-MM-dd')

  const result: GerarComissoesResult = { competencia: competenciaStr, geradas: 0, ignoradas: 0, erros: [] }

  const { data: indicacoes } = await db
    .from('indicacoes')
    .select('id, indicador_id, cliente_indicado_id, tipo_comissao, valor_fixo, percentual, indicadores(id, nome), clientes(id, nome, status)')
    .eq('status', 'ativa')
    .lte('data_inicio', fimStr)
    .or(`data_fim.is.null,data_fim.gte.${inicioStr}`)

  if (!indicacoes?.length) return result

  let categoriaId: string | null = null

  for (const indicacao of indicacoes as any[]) {
    try {
      const cliente = indicacao.clientes
      if (!cliente || cliente.status !== 'ativo') { result.ignoradas++; continue }

      const { data: existente } = await db
        .from('comissoes')
        .select('id')
        .eq('indicacao_id', indicacao.id)
        .eq('competencia', competenciaStr)
        .maybeSingle()
      if (existente) { result.ignoradas++; continue }

      let valor: number
      if (indicacao.tipo_comissao === 'fixo') {
        valor = Number(indicacao.valor_fixo)
      } else {
        const { data: receitas } = await db
          .from('lancamentos')
          .select('valor')
          .eq('cliente_id', indicacao.cliente_indicado_id)
          .eq('tipo', 'receita')
          .neq('status', 'cancelado')
          .gte('data', inicioStr)
          .lte('data', fimStr)
        const base = (receitas ?? []).reduce((s: number, r: any) => s + Number(r.valor), 0)
        if (base <= 0) { result.ignoradas++; continue }
        valor = Math.round(base * (Number(indicacao.percentual) / 100) * 100) / 100
      }

      if (!categoriaId) categoriaId = await resolveOrCreateCategoriaComissao(db)

      const { data: lancamento, error: lancErro } = await db
        .from('lancamentos')
        .insert({
          tipo: 'despesa',
          descricao: `Comissão de indicação — ${indicacao.indicadores?.nome ?? 'Indicador'} (ref. ${cliente.nome})`,
          valor,
          data: competenciaStr,
          data_competencia: competenciaStr,
          categoria_id: categoriaId,
          cliente_id: indicacao.cliente_indicado_id,
          status: 'pendente',
          recorrente: false,
        })
        .select('id')
        .single()
      if (lancErro || !lancamento) throw lancErro ?? new Error('Falha ao criar lançamento.')

      const { error: comissaoErro } = await db.from('comissoes').insert({
        indicacao_id: indicacao.id,
        indicador_id: indicacao.indicador_id,
        competencia: competenciaStr,
        valor,
        lancamento_id: lancamento.id,
      })
      if (comissaoErro) throw comissaoErro

      result.geradas++
    } catch (e: any) {
      result.erros.push({ indicacaoId: indicacao.id, erro: e?.message ?? 'Erro desconhecido' })
    }
  }

  return result
}

import 'server-only'
import { etapaDaRegua, type EtapaCobranca } from '@/lib/automacoes/regras'
import { diasEntre } from '@/lib/financeiro'
import { ehLinhaSaas, labelLinha } from '@/lib/financeiro/linhas'
import { formatCurrency, toISODateLocal } from '@/lib/utils'

// Régua de cobrança: uma vez por dia, junta quem chegou em 3, 7 ou 15 dias de
// atraso numa mensalidade e manda um aviso só no sino ("hoje: cobrar N clientes").
// Cada etapa é avisada uma vez por lançamento vencido (tabela cobranca_avisos).
// Entram mensalidades: receitas dos SaaS e das categorias marcadas como mensalidade.

type Vencido = {
  id: string
  data: string
  valor: number
  cliente_id: string
  frente: string
  clientes: { nome: string } | null
  categorias_financeiras: { recorrente: boolean } | null
}

export type ResultadoCobranca = { avisados: number; porEtapa: Record<EtapaCobranca, string[]>; pulado?: string }

export async function reguaDeCobranca(supabase: any): Promise<ResultadoCobranca> {
  const porEtapa: Record<EtapaCobranca, string[]> = { 3: [], 7: [], 15: [] }
  const hoje = toISODateLocal(new Date())

  const { data: jaAvisados, error } = await supabase.from('cobranca_avisos').select('lancamento_id, etapa')
  if (error) return { avisados: 0, porEtapa, pulado: 'Rode a migration 20261024000000_automacoes.sql' }
  const avisado = new Set((jaAvisados ?? []).map((a: { lancamento_id: string; etapa: number }) => `${a.lancamento_id}:${a.etapa}`))

  const { data } = await supabase.from('lancamentos')
    .select('id, data, valor, cliente_id, frente, clientes(nome), categorias_financeiras(recorrente)')
    .eq('tipo', 'receita').eq('status', 'pendente').lt('data', hoje).not('cliente_id', 'is', null)
  const mensalidades = ((data ?? []) as Vencido[]).filter((l) => ehLinhaSaas(l.frente) || l.categorias_financeiras?.recorrente)

  // Por cliente, vale a fatura vencida mais antiga (é ela que define a etapa).
  const porCliente = new Map<string, { maisAntiga: Vencido; total: number }>()
  for (const l of mensalidades) {
    const a = porCliente.get(l.cliente_id)
    if (!a) porCliente.set(l.cliente_id, { maisAntiga: l, total: Number(l.valor) })
    else {
      a.total += Number(l.valor)
      if (l.data < a.maisAntiga.data) a.maisAntiga = l
    }
  }

  const novos: { lancamento_id: string; etapa: EtapaCobranca }[] = []
  for (const { maisAntiga: l, total } of porCliente.values()) {
    const etapa = etapaDaRegua(diasEntre(l.data, hoje))
    if (!etapa || avisado.has(`${l.id}:${etapa}`)) continue
    novos.push({ lancamento_id: l.id, etapa })
    porEtapa[etapa].push(`${(l.clientes?.nome ?? 'Cliente').trim()} (${labelLinha(l.frente)}, ${formatCurrency(total)})`)
  }
  if (!novos.length) return { avisados: 0, porEtapa }

  await supabase.from('cobranca_avisos').upsert(novos)
  const partes = ([15, 7, 3] as const).filter((e) => porEtapa[e].length).map((e) => `${e === 15 ? '15+' : e} dias: ${porEtapa[e].join('; ')}`)
  await supabase.from('notificacoes').insert({
    usuario_id: null,
    titulo: `Cobrança: ${novos.length} cliente${novos.length === 1 ? '' : 's'} para cobrar hoje`,
    mensagem: partes.join(' · '),
    tipo: porEtapa[15].length ? 'erro' : 'alerta',
    link: '/financeiro/mrr?lista=atraso',
  })
  return { avisados: novos.length, porEtapa }
}

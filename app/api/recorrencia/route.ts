import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { asaasConfigurado } from '@/lib/asaas/api'
import { buscarAssinaturasAsaas } from '@/lib/asaas/assinaturas'
import { resumirRecorrencia, LINHAS_REC, type ClienteRec, type LancRec, type LinhaRec } from '@/lib/recorrencia'
import { hojeISO } from '@/lib/financeiro'
import { addMonthsISO } from '@/lib/utils'
import type { AssinaturaAsaas } from '@/lib/asaas/rotulos'

export type Categoria = { id: string; nome: string; recorrente: boolean }

// Usado só enquanto a migration 20261001000000_categorias_mrr.sql não foi aplicada.
const CATEGORIA_MENSALIDADE_RE = /mensal|assinatura|cat[aá]logo|recorr|saas|plano|retainer|fee/i

// MRR e assinaturas calculados no servidor: a tela recebe só o resultado, não
// todos os lançamentos. ?asaas=1 inclui as assinaturas do Asaas (mais lento:
// a tela pede primeiro sem e depois com). ?hoje=AAAA-MM-DD vem do navegador,
// para o mês virar no fuso de quem está olhando.
export async function GET(req: NextRequest) {
  const db = (await createClient()) as any
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const params = req.nextUrl.searchParams
  const hojeParam = params.get('hoje')
  const hoje = hojeParam && /^\d{4}-\d{2}-\d{2}$/.test(hojeParam) ? hojeParam : hojeISO()
  const comAsaas = params.get('asaas') === '1'
  let erro: string | null = null

  // O produto diz qual SaaS o cliente assina (Catálogo Place ou Clubelly).
  const campos = 'id, nome, empresa, whatsapp, telefone, status, created_at, tipo, produto:produtos(nome)'
  const camposLanc = 'valor, data, status, descricao, cliente_id, categoria_id, frente, clientes(nome, whatsapp, telefone), categorias_financeiras(nome)'
  const lancsDaLinha = (c: string) => db.from('lancamentos').select(c).eq('tipo', 'receita').in('frente', LINHAS_REC)
  const mesPassado = `${addMonthsISO(`${hoje.slice(0, 7)}-01`, -1)}`
  const asaasPromise: Promise<{ assinaturas: AssinaturaAsaas[]; erro: string | null }> = comAsaas && asaasConfigurado()
    ? buscarAssinaturasAsaas().then((a) => ({ assinaturas: a, erro: null }), (e) => {
      console.error('[recorrencia] asaas', e)
      return { assinaturas: [], erro: e instanceof Error ? e.message : 'Falha ao falar com o Asaas.' }
    })
    : Promise.resolve({ assinaturas: [], erro: null })

  const [resClientes, resLanc, resCats, resServicos, resTaxas, asaas] = await Promise.all([
    db.from('clientes').select(`${campos}, asaas_customer_id`).order('nome'),
    lancsDaLinha(`${camposLanc}, asaas_payment_id`),
    db.from('categorias_financeiras').select('id, nome, recorrente').eq('tipo', 'receita').order('nome'),
    db.from('assinatura_servicos').select('chave, linha, descricao'),
    // Taxas do Asaas do mês passado e deste (cobrado − o que caiu na conta).
    db.from('lancamentos').select('data, asaas_valor, asaas_valor_liquido')
      .eq('tipo', 'receita').eq('status', 'recebido').not('asaas_valor', 'is', null).gte('data', mesPassado),
    asaasPromise,
  ])

  // Sem a migration do Asaas a coluna não existe: carrega sem ela.
  let clientes: ClienteRec[] = resClientes.data
  if (resClientes.error) clientes = (await db.from('clientes').select(campos).order('nome')).data

  let lancamentos: LancRec[] = resLanc.data
  if (resLanc.error) {
    const r = await lancsDaLinha(camposLanc)
    lancamentos = r.data
    if (r.error) erro = 'Não foi possível carregar as mensalidades. A migration de frentes (20261007000000_frentes.sql) já foi aplicada no Supabase?'
  }

  let categorias: Categoria[]
  let semMigration = false
  if (resCats.error) {
    // Coluna `recorrente` ainda não existe: cai no palpite pelo nome.
    const r = await db.from('categorias_financeiras').select('id, nome').eq('tipo', 'receita').order('nome')
    categorias = ((r.data ?? []) as { id: string; nome: string }[]).map((c) => ({ ...c, recorrente: CATEGORIA_MENSALIDADE_RE.test(c.nome) }))
    semMigration = true
  } else {
    categorias = resCats.data ?? []
  }

  // Sem a migration 20261023000000_asaas_taxas.sql as colunas não existem: sem taxas.
  const taxasDoMes = (mes: string) => {
    const doMes = ((resTaxas.data ?? []) as { data: string; asaas_valor: number; asaas_valor_liquido: number | null }[])
      .filter((t) => t.data.slice(0, 7) === mes && t.asaas_valor_liquido != null)
    const cobrado = doMes.reduce((s, t) => s + Number(t.asaas_valor), 0)
    const taxa = doMes.reduce((s, t) => s + Math.max(Number(t.asaas_valor) - Number(t.asaas_valor_liquido), 0), 0)
    return { mes, pagamentos: doMes.length, cobrado, taxa }
  }

  const configurado = asaasConfigurado()
  const resumo = resumirRecorrencia({
    clientes: clientes ?? [],
    lancamentos: lancamentos ?? [],
    recorrentes: categorias.filter((c) => c.recorrente).map((c) => c.id),
    assinaturas: asaas.assinaturas,
    asaasCarregado: comAsaas && configurado && !asaas.erro && asaas.assinaturas.length > 0,
    hoje,
  })

  // porLinha repete as linhas: a tela remonta a partir de `linhas`.
  const { porLinha: _porLinha, ...semRepetir } = resumo
  return NextResponse.json({
    ...semRepetir,
    erro,
    categorias,
    semMigration,
    servicos: ((resServicos.data ?? []) as { chave: string; linha: LinhaRec; descricao: string }[]),
    semTabelaServicos: !!resServicos.error,
    asaas: { pedido: comAsaas, configurado, erro: asaas.erro },
    taxas: resTaxas.error ? null : { mesAtual: taxasDoMes(hoje.slice(0, 7)), mesPassado: taxasDoMes(mesPassado.slice(0, 7)) },
  })
}

export type RespostaRecorrencia = Omit<ReturnType<typeof resumirRecorrencia>, 'porLinha'> & {
  erro: string | null
  categorias: Categoria[]
  semMigration: boolean
  servicos: { chave: string; linha: LinhaRec; descricao: string }[]
  semTabelaServicos: boolean
  asaas: { pedido: boolean; configurado: boolean; erro: string | null }
  taxas: { mesAtual: TaxasMes; mesPassado: TaxasMes } | null
}

export type TaxasMes = { mes: string; pagamentos: number; cobrado: number; taxa: number }

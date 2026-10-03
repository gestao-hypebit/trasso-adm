import 'server-only'
import { buscarAssinatura, buscarClienteAsaas, type AsaasPayment } from '@/lib/asaas/api'

// Transforma uma cobrança do Asaas em lançamento, sem nunca duplicar:
//
// 1. Cobrança já ligada a um lançamento → só atualiza status (e o valor, se
//    foi a integração que criou o lançamento).
// 2. Vencimento antes da data de início da integração → ignora.
// 3. Acha o cliente pelo id do Asaas já salvo, ou pelo CPF/CNPJ, ou pelo e-mail.
// 4. Procura lançamento manual do mesmo cliente no mesmo mês, ainda sem
//    cobrança ligada (o valor não precisa bater: pode ter taxa/desconto).
//    - um só → liga a ele (valor manual é mantido)
//    - nenhum → cria o lançamento
//    - vários → vira pendência para decidir na tela
// Lançamentos criados pela integração são salvos pelo valor LÍQUIDO (o que cai
// na conta, já sem a taxa do Asaas). Lançamento manual ligado mantém o seu valor.

export type Acao = 'ignorado' | 'atualizado' | 'ligado' | 'criado' | 'pendencia'

export type Resultado = {
  acao: Acao
  paymentId: string
  vencimento: string
  valorAsaas: number
  valorLiquido: number
  status: string
  cliente?: string
  valorSistema?: number
  detalhe?: string
}

type ClienteRow = { id: string; nome: string; email: string | null; cpf_cnpj: string | null; asaas_customer_id: string | null; tipo: string | null }

export type Contexto = {
  supabase: any
  inicio: string
  simular?: boolean
  clientes?: ClienteRow[]
  categorias?: Map<string, string>
  // Na prévia nada é gravado: guarda em memória os lançamentos já "ligados"
  // para a próxima cobrança do mesmo cliente/mês não contar o mesmo de novo.
  usadosNaPrevia?: Set<string>
  // Situação de cada assinatura já consultada nesta execução.
  assinaturas?: Map<string, boolean>
  // Por que o cliente não foi achado (para a pendência/prévia).
  motivoCliente?: string
}

const so = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')
const normalizarNome = (v: string | null | undefined) =>
  (v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Assinatura cancelada/expirada no Asaas? (consulta uma vez por execução)
async function assinaturaAtiva(ctx: Contexto, id: string) {
  ctx.assinaturas ??= new Map()
  if (!ctx.assinaturas.has(id)) {
    // Se a consulta falhar, considera ativa: melhor processar do que sumir com uma cobrança.
    const a = await buscarAssinatura(id).catch(() => null)
    ctx.assinaturas.set(id, !a || (!a.deleted && a.status === 'ACTIVE'))
  }
  return ctx.assinaturas.get(id)!
}

export function statusDoLancamento(statusAsaas: string): 'recebido' | 'pendente' | 'cancelado' {
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(statusAsaas)) return 'recebido'
  if (['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'].includes(statusAsaas)) return 'cancelado'
  return 'pendente'
}

// Lançamento manual que você já marcou como recebido não volta a "pendente"
// (pode ter sido pago por fora do Asaas). Estorno/cancelamento ainda vale.
function manterRecebido(l: { asaas_criado: boolean; status: string }, novo: 'recebido' | 'pendente' | 'cancelado') {
  return !l.asaas_criado && l.status === 'recebido' && novo === 'pendente' ? 'recebido' : novo
}

// Valor que cai na conta. Antes do pagamento o Asaas já informa a estimativa;
// quando o pagamento cai, o webhook atualiza com o valor final.
const liquido = (p: AsaasPayment) => Number(Number(p.netValue ?? p.value).toFixed(2))

const formaPagamento: Record<string, string> = { PIX: 'pix', BOLETO: 'boleto', CREDIT_CARD: 'cartao_credito', DEBIT_CARD: 'cartao_debito' }

function fimDoMes(data: string) {
  const [y, m] = data.split('-').map(Number)
  return `${data.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

async function carregarClientes(ctx: Contexto) {
  if (!ctx.clientes) {
    const { data, error } = await ctx.supabase.from('clientes').select('id, nome, email, cpf_cnpj, asaas_customer_id, tipo')
    if (error) throw error
    ctx.clientes = data ?? []
  }
  return ctx.clientes!
}

async function categoriaId(ctx: Contexto, nome: string, tipo: 'receita' | 'despesa') {
  if (!ctx.categorias) {
    const { data } = await ctx.supabase.from('categorias_financeiras').select('id, nome, tipo')
    ctx.categorias = new Map((data ?? []).map((c: { id: string; nome: string; tipo: string }) => [`${c.tipo}:${c.nome.toLowerCase()}`, c.id]))
  }
  return ctx.categorias!.get(`${tipo}:${nome.toLowerCase()}`) ?? null
}

async function acharCliente(ctx: Contexto, customerId: string): Promise<ClienteRow | null> {
  const clientes = await carregarClientes(ctx)
  const ligado = clientes.find((c) => c.asaas_customer_id === customerId)
  if (ligado) return ligado

  const doAsaas = await buscarClienteAsaas(customerId)
  const doc = so(doAsaas.cpfCnpj)
  const email = doAsaas.email?.trim().toLowerCase() || ''
  const nome = normalizarNome(doAsaas.name)

  // Cliente já ligado a outro cadastro do Asaas não entra na disputa:
  // assim duas lojas com o mesmo CPF não caem no mesmo cliente.
  const livres = clientes.filter((c) => !c.asaas_customer_id || c.asaas_customer_id === customerId)
  const porEmail = email ? livres.filter((c) => c.email?.trim().toLowerCase() === email) : []
  const porDoc = doc ? livres.filter((c) => so(c.cpf_cnpj) === doc) : []
  const ambos = porEmail.filter((c) => porDoc.includes(c))

  // Ordem: e-mail + CPF/CNPJ → só e-mail → só CPF/CNPJ (se for um cliente só) → CPF/CNPJ + nome.
  let achado: ClienteRow | null = null
  if (ambos.length === 1) achado = ambos[0]
  else if (porEmail.length === 1) achado = porEmail[0]
  else if (porDoc.length === 1) achado = porDoc[0]
  else if (porDoc.length > 1) {
    const mesmoNome = porDoc.filter((c) => normalizarNome(c.nome) === nome)
    if (mesmoNome.length === 1) achado = mesmoNome[0]
    else ctx.motivoCliente = `${porDoc.length} clientes com o mesmo CPF/CNPJ e o e-mail do Asaas (${doAsaas.email || 'vazio'}) não bate com nenhum`
  }
  if (!achado && !ctx.motivoCliente) ctx.motivoCliente = `"${doAsaas.name}" não encontrado pelo e-mail nem pelo CPF/CNPJ`

  if (achado && !achado.asaas_customer_id) {
    if (!ctx.simular) await ctx.supabase.from('clientes').update({ asaas_customer_id: customerId }).eq('id', achado.id)
    achado.asaas_customer_id = customerId
  }
  return achado
}

async function registrarPendencia(ctx: Contexto, p: AsaasPayment, motivo: string, detalhes: Record<string, unknown>) {
  if (ctx.simular) return
  await ctx.supabase.from('asaas_pendencias').upsert(
    { payment_id: p.id, motivo, detalhes: { cobranca: p, ...detalhes }, resolvida: false, updated_at: new Date().toISOString() },
    { onConflict: 'payment_id' },
  )
}

async function resolverPendencia(ctx: Contexto, paymentId: string) {
  if (ctx.simular) return
  await ctx.supabase.from('asaas_pendencias').update({ resolvida: true, updated_at: new Date().toISOString() }).eq('payment_id', paymentId).eq('resolvida', false)
}

export async function processarCobranca(
  ctx: Contexto,
  p: AsaasPayment,
  opcoes: { excluida?: boolean; lancamentoEscolhido?: string } = {},
): Promise<Resultado> {
  const base = { paymentId: p.id, vencimento: p.dueDate, valorAsaas: Number(p.value), valorLiquido: liquido(p), status: p.status }
  const excluida = opcoes.excluida || p.deleted
  const status = statusDoLancamento(p.status)
  const camposAsaas = { asaas_status: excluida ? 'DELETED' : p.status, asaas_invoice_url: p.invoiceUrl }

  // 1. Já ligada
  const { data: ligado } = await ctx.supabase
    .from('lancamentos')
    .select('id, valor, status, asaas_criado, cliente_id, forma_pagamento, clientes(nome)')
    .eq('asaas_payment_id', p.id)
    .maybeSingle()
  if (ligado) {
    const resultado = { ...base, acao: 'atualizado' as const, cliente: ligado.clientes?.nome, valorSistema: Number(ligado.valor) }
    if (ctx.simular) return resultado
    if (excluida) {
      if (ligado.asaas_criado) {
        await ctx.supabase.from('lancamentos').update({ ...camposAsaas, status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', ligado.id)
      } else {
        // Lançamento manual: não apaga nem cancela; solta da cobrança e avisa.
        await ctx.supabase.from('lancamentos').update({ asaas_payment_id: null, asaas_status: null, asaas_invoice_url: null }).eq('id', ligado.id)
        await registrarPendencia(ctx, p, 'cobranca_excluida', { lancamento_id: ligado.id })
      }
      return { ...resultado, detalhe: 'Cobrança excluída no Asaas' }
    }
    const { error } = await ctx.supabase.from('lancamentos').update({
      ...camposAsaas,
      status: manterRecebido(ligado, status),
      forma_pagamento: ligado.forma_pagamento ?? formaPagamento[p.billingType] ?? null,
      ...(ligado.asaas_criado ? { valor: liquido(p), data: p.dueDate } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', ligado.id)
    if (error) throw error
    return resultado
  }

  // 2. Fora do período da integração (ou excluída sem nada ligado)
  if (p.dueDate < ctx.inicio || excluida) return { ...base, acao: 'ignorado', detalhe: excluida ? 'Cobrança excluída' : 'Vencimento antes do início da integração' }

  // 3. Assinatura cancelada: cobrança que ficou em aberto não entra (não é receita esperada).
  //    Se foi paga mesmo assim, entra normalmente.
  if (p.subscription && status !== 'recebido' && !(await assinaturaAtiva(ctx, p.subscription))) {
    return { ...base, acao: 'ignorado', detalhe: 'Assinatura cancelada no Asaas' }
  }

  // 4. Cliente
  ctx.motivoCliente = undefined
  const cliente = await acharCliente(ctx, p.customer)
  if (!cliente) {
    const detalhe = ctx.motivoCliente ?? 'Cliente do Asaas não encontrado'
    await registrarPendencia(ctx, p, 'cliente_nao_encontrado', { observacao: detalhe })
    return { ...base, acao: 'pendencia', detalhe }
  }

  // 5. Lançamento manual do mesmo mês
  let candidatos: { id: string; valor: number; descricao: string; data: string; status: string }[]
  if (opcoes.lancamentoEscolhido) {
    const { data } = await ctx.supabase.from('lancamentos').select('id, valor, descricao, data, status').eq('id', opcoes.lancamentoEscolhido).is('asaas_payment_id', null)
    candidatos = data ?? []
  } else {
    const { data } = await ctx.supabase
      .from('lancamentos')
      .select('id, valor, descricao, data, status')
      .eq('tipo', 'receita')
      .eq('cliente_id', cliente.id)
      .is('asaas_payment_id', null)
      .neq('status', 'cancelado')
      .gte('data', `${p.dueDate.slice(0, 7)}-01`)
      .lte('data', fimDoMes(p.dueDate))
    candidatos = data ?? []
  }
  if (ctx.simular) {
    ctx.usadosNaPrevia ??= new Set()
    candidatos = candidatos.filter((c) => !ctx.usadosNaPrevia!.has(c.id))
  }

  if (candidatos.length > 1) {
    await registrarPendencia(ctx, p, 'varios_lancamentos', { cliente_id: cliente.id, cliente_nome: cliente.nome, candidatos })
    return { ...base, acao: 'pendencia', cliente: cliente.nome, detalhe: `${candidatos.length} lançamentos desse cliente no mesmo mês` }
  }

  if (candidatos.length === 1) {
    const c = candidatos[0]
    const resultado = { ...base, acao: 'ligado' as const, cliente: cliente.nome, valorSistema: Number(c.valor) }
    if (ctx.simular) {
      ctx.usadosNaPrevia!.add(c.id)
      return resultado
    }
    const { error } = await ctx.supabase.from('lancamentos').update({
      ...camposAsaas,
      asaas_payment_id: p.id,
      status: manterRecebido({ asaas_criado: false, status: c.status }, status),
      updated_at: new Date().toISOString(),
    }).eq('id', c.id).is('asaas_payment_id', null)
    if (error) throw error
    await resolverPendencia(ctx, p.id)
    return resultado
  }

  // Nenhum: cria
  const resultado = { ...base, acao: 'criado' as const, cliente: cliente.nome, valorSistema: liquido(p) }
  if (ctx.simular) return resultado
  const categoria = cliente.tipo === 'saas'
    ? await categoriaId(ctx, 'Catálogo Place', 'receita')
    : await categoriaId(ctx, p.subscription ? 'Mensalidade de Software' : 'Serviços prestados', 'receita')
  const { error } = await ctx.supabase.from('lancamentos').insert({
    tipo: 'receita',
    descricao: p.description || `${cliente.tipo === 'saas' ? 'Catálogo Place' : 'Cobrança'} — ${cliente.nome}`,
    valor: liquido(p),
    data: p.dueDate,
    status,
    categoria_id: categoria,
    cliente_id: cliente.id,
    forma_pagamento: formaPagamento[p.billingType] ?? null,
    recorrente: false,
    asaas_payment_id: p.id,
    asaas_criado: true,
    ...camposAsaas,
  })
  // Outro aviso criou ao mesmo tempo (índice único): trata como já ligado.
  if (error?.code === '23505') return processarCobranca(ctx, p, opcoes)
  if (error) throw error
  await resolverPendencia(ctx, p.id)
  return resultado
}

// Data de início da integração (nula = desligada).
export async function inicioIntegracao(supabase: any): Promise<string | null> {
  const { data } = await supabase.from('configuracoes_agencia').select('asaas_inicio').limit(1).maybeSingle()
  return data?.asaas_inicio ?? null
}

// Depois de alterar algo no Asaas pelo painel, já atualiza os lançamentos
// (sem esperar o webhook). Integração desligada → não faz nada. Falhas só
// são registradas: o webhook ou o "Sincronizar" corrigem depois.
export async function refletirNoSistema(supabase: any, cobrancas: AsaasPayment[], opcoes: { excluida?: boolean } = {}) {
  const inicio = await inicioIntegracao(supabase)
  if (!inicio) return
  const ctx: Contexto = { supabase, inicio }
  for (const c of cobrancas) {
    try {
      await processarCobranca(ctx, c, opcoes)
    } catch (e) {
      console.error('[asaas] refletir no sistema', c.id, e)
    }
  }
}

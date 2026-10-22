import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { asaasConfigurado, buscarClienteAsaas, cobrancasDoCliente } from '@/lib/asaas/api'
import { usuarioLogado } from '@/lib/asaas/auth'
import { inicioIntegracao, processarCobranca } from '@/lib/asaas/processar'

// Liga um cliente do Asaas ao sistema e passa as cobranças dele pela integração:
// viram lançamentos e as pendências de "cliente não encontrado" somem.
// Corpo:
//   { clienteId }                     → liga a um cliente que já existe;
//   { tipo, produtoId? }              → cria o cliente com os dados do Asaas
//                                       (nome, e-mail, telefone, CPF/CNPJ).
export async function POST(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!asaasConfigurado()) return NextResponse.json({ error: 'ASAAS_API_KEY não configurada no servidor.' }, { status: 400 })

  const { customerId } = await params
  const corpo = (await req.json().catch(() => ({}))) as { clienteId?: string; tipo?: string; produtoId?: string }
  const tipo = ['agencia', 'saas', 'ambos'].includes(corpo.tipo ?? '') ? corpo.tipo! : 'saas'
  if (!corpo.clienteId && tipo !== 'agencia' && !corpo.produtoId) return NextResponse.json({ error: 'Escolha o produto SaaS.' }, { status: 400 })

  const supabase = createServiceClient() as any
  try {
    const { data: jaLigado } = await supabase.from('clientes').select('id').eq('asaas_customer_id', customerId).maybeSingle()
    if (jaLigado) return NextResponse.json({ error: 'Esse cliente do Asaas já está ligado a um cliente do sistema.' }, { status: 400 })

    let clienteId = corpo.clienteId
    if (clienteId) {
      const { error } = await supabase.from('clientes').update({ asaas_customer_id: customerId }).eq('id', clienteId)
      if (error) return NextResponse.json({ error: error.code === '23505' ? 'Esse cliente do Asaas já está ligado a outro cliente.' : error.message }, { status: 400 })
    } else {
      clienteId = await criarCliente(supabase, customerId, tipo, corpo.produtoId ?? null)
    }

    const inicio = await inicioIntegracao(supabase)
    let processadas = 0
    if (inicio) {
      const ctx = { supabase, inicio }
      for (const p of await cobrancasDoCliente(customerId)) {
        if (p.dueDate < inicio || p.deleted) continue
        await processarCobranca(ctx, p)
        processadas++
      }
    }
    return NextResponse.json({ ok: true, clienteId, processadas })
  } catch (e) {
    console.error('[asaas] ligar cliente', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao falar com o Asaas.' }, { status: 502 })
  }
}

async function criarCliente(supabase: any, customerId: string, tipo: string, produtoId: string | null): Promise<string> {
  const c = await buscarClienteAsaas(customerId)
  const { data: novo, error } = await supabase.from('clientes').insert({
    nome: c.name.trim(),
    email: c.email?.trim() || null,
    telefone: c.phone || null,
    whatsapp: c.mobilePhone || null,
    cpf_cnpj: c.cpfCnpj || null,
    status: 'ativo',
    tipo,
    produto_id: tipo === 'agencia' ? null : produtoId,
    asaas_customer_id: customerId,
    observacoes: 'Criado a partir do Asaas.',
  }).select('id').single()
  if (error) throw new Error(error.message)
  return novo.id
}

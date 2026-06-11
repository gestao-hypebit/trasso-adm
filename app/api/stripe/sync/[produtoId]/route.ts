import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { mapSubscription } from '@/lib/stripe/mappers'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ produtoId: string }> }
) {
  try {
    const { produtoId } = await params
    const supabase = await createClient() as any

    const { data: produto, error: produtoError } = await supabase
      .from('produtos')
      .select('id, stripe_secret_key')
      .eq('id', produtoId)
      .single() as { data: { id: string; stripe_secret_key: string | null } | null; error: unknown }

    if (produtoError) {
      console.error('[sync] erro ao buscar produto:', produtoError)
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    }

    if (!produto?.stripe_secret_key) {
      return NextResponse.json({ error: 'Chave Stripe não configurada para este produto.' }, { status: 400 })
    }

    const stripe = new Stripe(produto.stripe_secret_key)

    let sincronizados = 0
    let erros = 0
    const detalhesErros: string[] = []

    for await (const sub of stripe.subscriptions.list({
      limit: 100,
      status: 'all',
      expand: ['data.customer', 'data.items.data.price'],
    })) {
      const customer = sub.customer as Stripe.Customer
      if (typeof customer === 'string' || customer.deleted) continue

      const payload = {
        produto_id: produtoId,
        ...mapSubscription(sub, customer),
      }

      const { error: upsertError } = await supabase
        .from('saas_clientes')
        .upsert(payload, { onConflict: 'stripe_subscription_id' })

      if (upsertError) {
        erros++
        detalhesErros.push(`sub ${sub.id}: ${JSON.stringify(upsertError)}`)
        console.error('[sync] erro upsert:', upsertError)
      } else {
        sincronizados++
      }
    }

    await supabase
      .from('produtos')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', produtoId)

    return NextResponse.json({ sincronizados, erros, detalhesErros })
  } catch (err: any) {
    console.error('[sync] erro inesperado:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Erro interno ao sincronizar.' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { mapSubscription } from '@/lib/stripe/mappers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ produtoId: string }> }
) {
  const { produtoId } = await params
  const body = await req.text()
  const sig = (await headers()).get('stripe-signature')

  const supabase = createServiceClient() as any

  const { data: produto } = await supabase
    .from('produtos')
    .select('stripe_secret_key, stripe_webhook_secret')
    .eq('id', produtoId)
    .single() as { data: { stripe_secret_key: string | null; stripe_webhook_secret: string | null } | null }

  if (!produto?.stripe_secret_key || !produto?.stripe_webhook_secret) {
    return NextResponse.json({ error: 'Produto não configurado.' }, { status: 400 })
  }

  const stripe = new Stripe(produto.stripe_secret_key)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, produto.stripe_webhook_secret)
  } catch {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 })
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer
      if (customer.deleted) break

      const payload = { produto_id: produtoId, ...mapSubscription(sub, customer) }
      await supabase.from('saas_clientes').upsert(payload, { onConflict: 'stripe_subscription_id' })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('saas_clientes')
        .update({
          status: 'cancelado',
          data_cancelamento: new Date().toISOString().slice(0, 10),
        })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const subDetails = invoice.parent?.subscription_details
      const subId = subDetails
        ? typeof subDetails.subscription === 'string'
          ? subDetails.subscription
          : subDetails.subscription?.id
        : null
      if (subId) {
        await supabase
          .from('saas_clientes')
          .update({ status: 'ativo' })
          .eq('stripe_subscription_id', subId)
          .eq('status', 'inadimplente')
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subDetails = invoice.parent?.subscription_details
      const subId = subDetails
        ? typeof subDetails.subscription === 'string'
          ? subDetails.subscription
          : subDetails.subscription?.id
        : null
      if (subId) {
        await supabase
          .from('saas_clientes')
          .update({ status: 'inadimplente' })
          .eq('stripe_subscription_id', subId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

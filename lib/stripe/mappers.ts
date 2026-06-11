import type Stripe from 'stripe'

const STATUS_MAP: Record<string, string> = {
  active: 'ativo',
  trialing: 'trial',
  canceled: 'cancelado',
  past_due: 'inadimplente',
  unpaid: 'inadimplente',
  incomplete: 'trial',
  incomplete_expired: 'cancelado',
  paused: 'cancelado',
}

export function mapSubscription(sub: Stripe.Subscription, customer: Stripe.Customer) {
  const item = sub.items.data[0]
  const price = item?.price
  const amount = (price?.unit_amount ?? 0) / 100
  const interval = price?.recurring?.interval
  const mrr = interval === 'year' ? amount / 12 : amount

  // price.product não é expandido (limite de 4 níveis do Stripe)
  // usa nickname do price como nome do plano
  const plano = price?.nickname ?? null

  // Convert Unix timestamp to YYYY-MM-DD using UTC date (avoids timezone shifting)
  const tsToDate = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10)

  return {
    stripe_customer_id: customer.id,
    stripe_subscription_id: sub.id,
    nome: customer.name || customer.email || 'Cliente Stripe',
    email: customer.email,
    plano,
    mrr: Math.round(mrr * 100) / 100,
    status: STATUS_MAP[sub.status] ?? 'ativo',
    data_inicio: tsToDate(sub.start_date),
    data_cancelamento: sub.canceled_at ? tsToDate(sub.canceled_at) : null,
    ultimo_pagamento: item?.current_period_start ? tsToDate(item.current_period_start) : null,
    proximo_vencimento: item?.current_period_end ? tsToDate(item.current_period_end) : null,
  }
}

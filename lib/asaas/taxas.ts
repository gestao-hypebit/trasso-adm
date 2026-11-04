import type { AsaasAntecipacao, AsaasPayment } from '@/lib/asaas/api'

// Regras do valor líquido de uma cobrança do Asaas.

const centavos = (v: number) => Number(v.toFixed(2))

// Em aberto e com "cliente escolhe a forma": o netValue é só a maior taxa possível
// (R$ 200 aparece com a taxa de cartão, e no PIX sai por R$ 1,99). Não é taxa de verdade.
export function formaAindaIndefinida(p: Pick<AsaasPayment, 'billingType' | 'status'>) {
  return p.billingType === 'UNDEFINED' && ['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS'].includes(p.status)
}

// Depois de antecipada, o netValue da cobrança sobe para o valor cheio e a taxa do
// cartão some. Vale o último líquido menor que o cobrado, avisado com a mesma forma
// de pagamento (com outra forma ele era só a estimativa).
export function liquidoAntesDaAntecipacao(
  p: Pick<AsaasPayment, 'value' | 'netValue' | 'billingType'>,
  avisos: Pick<AsaasPayment, 'netValue' | 'billingType'>[],
) {
  const valor = Number(p.value)
  const atual = Number(p.netValue ?? p.value)
  if (atual < valor) return atual
  const anterior = avisos.filter((a) => a.billingType === p.billingType && a.netValue != null && Number(a.netValue) < valor).at(-1)
  return anterior ? Number(anterior.netValue) : atual
}

// Tira do líquido o custo das antecipações que não foram negadas nem canceladas.
export function descontarAntecipacoes(liquido: number, antecipacoes: Pick<AsaasAntecipacao, 'fee' | 'status'>[]) {
  const custo = antecipacoes
    .filter((a) => !['DENIED', 'CANCELLED'].includes(a.status))
    .reduce((s, a) => s + Number(a.fee ?? 0), 0)
  return centavos(liquido - custo)
}

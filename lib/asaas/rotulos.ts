// Nomes em português para os códigos do Asaas (usado nas telas).

export type AssinaturaAsaas = {
  id: string
  customerId: string
  customerNome: string | null
  customerEmail: string | null
  customerTelefone: string | null
  valor: number
  ciclo: string
  // nextDueDate do Asaas: vencimento da próxima fatura que ele AINDA VAI GERAR.
  // Como a fatura é gerada com antecedência, pode já estar no mês seguinte.
  proximoVencimento: string
  // Próxima cobrança de fato: a fatura aguardando pagamento mais próxima
  // ou, se não houver, a próxima que será gerada.
  proximaCobranca: string
  // Faturas vencidas e não pagas desta assinatura.
  vencidas: number
  formaPagamento: string
  descricao: string | null
  criadaEm: string
  status: string
}

export type CobrancaAsaas = {
  id: string
  assinaturaId: string | null
  valor: number
  valorLiquido: number | null
  vencimento: string
  pagoEm: string | null
  status: string
  formaPagamento: string
  descricao: string | null
  faturaUrl: string | null
  boletoUrl: string | null
  numero: string | null
}

export const cicloLabel: Record<string, string> = {
  WEEKLY: 'semanal', BIWEEKLY: 'quinzenal', MONTHLY: 'mensal',
  BIMONTHLY: 'bimestral', QUARTERLY: 'trimestral', SEMIANNUALLY: 'semestral', YEARLY: 'anual',
}

// Quanto a assinatura representa por mês (para comparar com o MRR).
const porMes: Record<string, number> = {
  WEEKLY: 52 / 12, BIWEEKLY: 26 / 12, MONTHLY: 1, BIMONTHLY: 1 / 2, QUARTERLY: 1 / 3, SEMIANNUALLY: 1 / 6, YEARLY: 1 / 12,
}
export const valorMensal = (a: AssinaturaAsaas) => a.valor * (porMes[a.ciclo] ?? 1)

export const formaLabel: Record<string, string> = {
  PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de crédito', DEBIT_CARD: 'Cartão de débito', UNDEFINED: 'Cliente escolhe',
}

export const assinaturaStatus: Record<string, { label: string; variant: 'aprovada' | 'inativo' | 'urgente' }> = {
  ACTIVE: { label: 'Ativa', variant: 'aprovada' },
  INACTIVE: { label: 'Cancelada', variant: 'inativo' },
  EXPIRED: { label: 'Encerrada', variant: 'inativo' },
}

type Variante = 'aprovada' | 'pendente' | 'urgente' | 'inativo' | 'outline'
export function cobrancaStatus(status: string): { label: string; variant: Variante; aberta: boolean } {
  switch (status) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'RECEIVED_IN_CASH':
      return { label: status === 'RECEIVED_IN_CASH' ? 'Paga (em dinheiro)' : 'Paga', variant: 'aprovada', aberta: false }
    case 'PENDING':
      return { label: 'Aguardando', variant: 'pendente', aberta: true }
    case 'OVERDUE':
      return { label: 'Vencida', variant: 'urgente', aberta: true }
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'REFUND_IN_PROGRESS':
      return { label: 'Estornada', variant: 'inativo', aberta: false }
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
    case 'AWAITING_CHARGEBACK_REVERSAL':
      return { label: 'Chargeback', variant: 'urgente', aberta: false }
    case 'AWAITING_RISK_ANALYSIS':
      return { label: 'Em análise', variant: 'outline', aberta: true }
    default:
      return { label: status, variant: 'outline', aberta: false }
  }
}

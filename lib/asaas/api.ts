import 'server-only'

// Cliente mínimo da API do Asaas (v3).
// Variáveis de ambiente:
//   ASAAS_API_KEY        chave de API (Minha Conta → Integrações)
//   ASAAS_WEBHOOK_TOKEN  token que você define ao cadastrar o webhook no Asaas
//   ASAAS_AMBIENTE       "sandbox" para testes; qualquer outro valor = produção

export type AsaasPayment = {
  id: string
  customer: string
  subscription: string | null
  value: number
  netValue: number | null
  status: string
  dueDate: string
  paymentDate: string | null
  clientPaymentDate: string | null
  billingType: string
  invoiceUrl: string | null
  bankSlipUrl?: string | null
  invoiceNumber?: string | null
  description: string | null
  deleted?: boolean
}

export type AsaasSubscription = {
  id: string
  customer: string
  value: number
  nextDueDate: string
  cycle: string // MONTHLY | WEEKLY | BIWEEKLY | QUARTERLY | SEMIANNUALLY | YEARLY
  billingType: string
  description: string | null
  dateCreated: string
  status: string // ACTIVE | INACTIVE | EXPIRED
  deleted?: boolean
}

export type AsaasCustomer = {
  id: string
  name: string
  email: string | null
  cpfCnpj: string | null
  mobilePhone?: string | null
  phone?: string | null
}

const baseUrl = () =>
  process.env.ASAAS_AMBIENTE === 'sandbox' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'

export const asaasConfigurado = () => !!process.env.ASAAS_API_KEY

export class AsaasErro extends Error {
  constructor(public status: number, public descricao: string, path: string) {
    super(`Asaas ${status} em ${path}: ${descricao}`)
  }
}

async function asaasRequest<T>(path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', corpo?: unknown): Promise<T> {
  const key = process.env.ASAAS_API_KEY
  if (!key) throw new Error('ASAAS_API_KEY não configurada.')
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      access_token: key, 'User-Agent': 'TrassoAdmin/1.0', accept: 'application/json',
      ...(corpo ? { 'content-type': 'application/json' } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const texto = await res.text().catch(() => '')
    // O Asaas devolve { errors: [{ code, description }] }: mostra a descrição.
    let descricao = texto.slice(0, 300)
    try {
      const json = JSON.parse(texto) as { errors?: { description?: string }[] }
      if (json.errors?.length) descricao = json.errors.map((e) => e.description).filter(Boolean).join(' ')
    } catch {}
    throw new AsaasErro(res.status, descricao, path)
  }
  return res.json() as Promise<T>
}

const asaasGet = <T,>(path: string) => asaasRequest<T>(path)

export const buscarCobranca = (id: string) => asaasGet<AsaasPayment>(`/payments/${encodeURIComponent(id)}`)
export const buscarClienteAsaas = (id: string) => asaasGet<AsaasCustomer>(`/customers/${encodeURIComponent(id)}`)
export const buscarAssinatura = (id: string) => asaasGet<AsaasSubscription>(`/subscriptions/${encodeURIComponent(id)}`)

// Percorre todas as páginas de uma listagem (`filtro` já vem codificado).
async function listarTudo<T>(recurso: string, filtro = ''): Promise<T[]> {
  const todas: T[] = []
  for (let offset = 0; ; offset += 100) {
    const pagina = await asaasGet<{ data: T[]; hasMore: boolean }>(
      `/${recurso}?${filtro ? `${filtro}&` : ''}limit=100&offset=${offset}`,
    )
    todas.push(...pagina.data)
    if (!pagina.hasMore || offset > 10_000) break
  }
  return todas
}

// Todas as cobranças com vencimento a partir de `desde` (YYYY-MM-DD).
export const listarCobrancas = (desde: string) => listarTudo<AsaasPayment>('payments', `dueDate%5Bge%5D=${desde}`)

export const listarAssinaturas = () => listarTudo<AsaasSubscription>('subscriptions')

// Cobranças ainda não pagas de uma situação (PENDING = aguardando, OVERDUE = vencida).
export const listarCobrancasPorStatus = (status: 'PENDING' | 'OVERDUE') => listarTudo<AsaasPayment>('payments', `status=${status}`)
export const listarClientesAsaas = () => listarTudo<AsaasCustomer>('customers')

// Faturas de um cliente (das assinaturas e avulsas), mais recentes primeiro.
export async function cobrancasDoCliente(customerId: string): Promise<AsaasPayment[]> {
  const todas = await listarTudo<AsaasPayment>('payments', `customer=${encodeURIComponent(customerId)}`)
  return todas.sort((a, b) => b.dueDate.localeCompare(a.dueDate))
}

// Cobranças de uma assinatura (opcionalmente só de uma situação, ex.: PENDING).
export const cobrancasDaAssinatura = (id: string, status?: string) =>
  listarTudo<AsaasPayment>(`subscriptions/${encodeURIComponent(id)}/payments`, status ? `status=${status}` : '')

// ---- Alterações (mexem na conta do Asaas) ----

// Muda vencimento/valor de uma cobrança em aberto. O link da fatura continua o
// mesmo e passa a mostrar a nova data (é a "2ª via").
export const atualizarCobranca = (id: string, dados: { dueDate: string; value: number; billingType: string }) =>
  asaasRequest<AsaasPayment>(`/payments/${encodeURIComponent(id)}`, 'POST', dados)

// Marca como paga uma cobrança recebida fora do Asaas.
export const receberEmDinheiro = (id: string, dados: { paymentDate: string; value: number }) =>
  asaasRequest<AsaasPayment>(`/payments/${encodeURIComponent(id)}/receiveInCash`, 'POST', { ...dados, notifyCustomer: false })

export const excluirCobranca = (id: string) =>
  asaasRequest<{ deleted: boolean }>(`/payments/${encodeURIComponent(id)}`, 'DELETE')

// updatePendingPayments=true leva o novo valor/forma também às cobranças já geradas e em aberto.
export const atualizarAssinatura = (
  id: string,
  dados: { value?: number; nextDueDate?: string; billingType?: string; updatePendingPayments?: boolean },
) => asaasRequest<AsaasSubscription>(`/subscriptions/${encodeURIComponent(id)}`, 'POST', dados)

export const cancelarAssinatura = (id: string) =>
  asaasRequest<{ deleted: boolean }>(`/subscriptions/${encodeURIComponent(id)}`, 'DELETE')

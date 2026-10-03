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
  description: string | null
  deleted?: boolean
}

export type AsaasCustomer = {
  id: string
  name: string
  email: string | null
  cpfCnpj: string | null
}

const baseUrl = () =>
  process.env.ASAAS_AMBIENTE === 'sandbox' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'

export const asaasConfigurado = () => !!process.env.ASAAS_API_KEY

async function asaasGet<T>(path: string): Promise<T> {
  const key = process.env.ASAAS_API_KEY
  if (!key) throw new Error('ASAAS_API_KEY não configurada.')
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { access_token: key, 'User-Agent': 'TrassoAdmin/1.0', accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    const corpo = await res.text().catch(() => '')
    throw new Error(`Asaas ${res.status} em ${path}: ${corpo.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

export const buscarCobranca = (id: string) => asaasGet<AsaasPayment>(`/payments/${encodeURIComponent(id)}`)
export const buscarClienteAsaas = (id: string) => asaasGet<AsaasCustomer>(`/customers/${encodeURIComponent(id)}`)

// Todas as cobranças com vencimento a partir de `desde` (YYYY-MM-DD).
export async function listarCobrancas(desde: string): Promise<AsaasPayment[]> {
  const todas: AsaasPayment[] = []
  for (let offset = 0; ; offset += 100) {
    const pagina = await asaasGet<{ data: AsaasPayment[]; hasMore: boolean }>(
      `/payments?dueDate%5Bge%5D=${desde}&limit=100&offset=${offset}`,
    )
    todas.push(...pagina.data)
    if (!pagina.hasMore || offset > 10_000) break
  }
  return todas
}

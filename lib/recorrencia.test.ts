import { describe, expect, it } from 'vitest'
import { linhaDaAssinatura, montarLinha, type ClienteRec, type Dados, type LancRec } from '@/lib/recorrencia'
import { linhaDoProduto, linhaPelaDescricao } from '@/lib/financeiro/linhas'
import type { AssinaturaAsaas } from '@/lib/asaas/rotulos'

const HOJE = '2026-10-22'
const REC = 'cat-mensalidade'

function cliente(id: string, tipo: string, extra: Partial<ClienteRec> = {}): ClienteRec {
  return { id, nome: id, empresa: null, whatsapp: null, telefone: null, status: 'ativo', created_at: '2026-01-01', tipo, asaas_customer_id: `cus_${id}`, produto: null, ...extra }
}

function lanc(cliente_id: string, frente: string, data: string, valor: number, extra: Partial<LancRec> = {}): LancRec {
  return {
    valor, data, status: 'recebido', descricao: `Mensalidade ${cliente_id}`, cliente_id,
    clientes: { nome: cliente_id, whatsapp: null, telefone: null }, categorias_financeiras: { nome: 'Mensalidade' },
    categoria_id: REC, asaas_payment_id: null, frente, ...extra,
  }
}

function sub(id: string, customerId: string, valor: number, extra: Partial<AssinaturaAsaas> = {}): AssinaturaAsaas {
  return {
    id, customerId, customerNome: null, customerEmail: null, customerTelefone: null, valor, ciclo: 'MONTHLY',
    proximoVencimento: '2026-11-10', proximaCobranca: '2026-11-10', vencidas: 0, cobrancasRecentes: [],
    formaPagamento: 'PIX', descricao: null, criadaEm: '2026-01-01', status: 'ACTIVE', jaPagou: true, ...extra,
  }
}

const dados = (d: Partial<Dados>): Dados => ({
  clientes: [], lancamentos: [], recorrentes: [REC], assinaturas: [], asaasCarregado: true, hoje: HOJE, ...d,
})

describe('qual SaaS', () => {
  it('produto com "Clubelly" no nome é Clubelly; o resto (ou sem produto) é Catálogo', () => {
    expect(linhaDoProduto('Clubelly')).toBe('clubelly')
    expect(linhaDoProduto('Catálogo Place')).toBe('catalogo_place')
    expect(linhaDoProduto(null)).toBe('catalogo_place')
  })

  it('descrição da cobrança diz o SaaS quando cita o nome', () => {
    expect(linhaPelaDescricao('Assinatura Clubelly')).toBe('clubelly')
    expect(linhaPelaDescricao('Catalogo Place mensal')).toBe('catalogo_place')
    expect(linhaPelaDescricao('Social media')).toBeNull()
  })
})

describe('linha da assinatura do Asaas', () => {
  it('cliente só SaaS segue o produto do cadastro', () => {
    const c = cliente('a', 'saas', { produto: { nome: 'Clubelly' } })
    expect(linhaDaAssinatura(sub('s', 'cus_a', 197), c, new Map())).toBe('clubelly')
  })

  it('fatura ligada a lançamento de Serviços vale mais que descrição falando em Catálogo', () => {
    const c = cliente('w', 'ambos')
    const s = sub('s', 'cus_w', 200, { descricao: 'Catálogo Place', cobrancasRecentes: ['pay1'] })
    expect(linhaDaAssinatura(s, c, new Map([['pay1', 'agencia']]))).toBe('agencia')
  })

  it('sem fatura ligada, cai na descrição e depois em Serviços', () => {
    const c = cliente('w', 'ambos')
    expect(linhaDaAssinatura(sub('s', 'cus_w', 49.9, { descricao: 'Catálogo' }), c, new Map())).toBe('catalogo_place')
    expect(linhaDaAssinatura(sub('s', 'cus_w', 200), c, new Map())).toBe('agencia')
  })
})

describe('Catálogo e Clubelly separados', () => {
  it('cada cliente SaaS aparece só na linha do seu produto', () => {
    const d = dados({
      clientes: [cliente('cat', 'saas', { produto: { nome: 'Catálogo Place' } }), cliente('clu', 'saas', { produto: { nome: 'Clubelly' } })],
      assinaturas: [sub('s1', 'cus_cat', 49.9), sub('s2', 'cus_clu', 197)],
      lancamentos: [lanc('cat', 'catalogo_place', '2026-10-11', 47.91), lanc('clu', 'clubelly', '2026-10-21', 195.01)],
    })
    const catalogo = montarLinha('catalogo_place', d)
    const clubelly = montarLinha('clubelly', d)
    expect(catalogo.linhas.map((l) => l.chave)).toEqual(['cat'])
    expect(clubelly.linhas.map((l) => l.chave)).toEqual(['clu'])
    expect(clubelly.mrrBruto).toBe(197)
    expect(clubelly.mrrLiquido).toBe(195.01)
  })
})

describe('ativas, canceladas e inadimplentes', () => {
  it('cancelou no Asaas depois de pagar: sai das ativas e do MRR, mesmo com fatura recente lançada', () => {
    const d = dados({
      clientes: [cliente('x', 'saas')],
      assinaturas: [sub('s', 'cus_x', 49.9, { status: 'INACTIVE', removida: true })],
      lancamentos: [lanc('x', 'catalogo_place', '2026-09-11', 47.91, { asaas_payment_id: 'pay1' })],
    })
    const r = montarLinha('catalogo_place', d)
    expect(r.linhas[0].cancelada).toBe(true)
    expect(r.linhas[0].ativo).toBe(false)
    expect(r.ativas).toBe(0)
    expect(r.mrrBruto).toBe(0)
    expect(r.mrrLiquido).toBe(0)
  })

  it('cancelou no Asaas mas paga por fora (lançamento manual recebido): continua ativo', () => {
    const d = dados({
      clientes: [cliente('x', 'saas')],
      assinaturas: [sub('s', 'cus_x', 49.9, { status: 'INACTIVE', removida: true })],
      lancamentos: [
        lanc('x', 'catalogo_place', '2026-08-11', 47.91, { asaas_payment_id: 'pay0' }),
        lanc('x', 'catalogo_place', '2026-10-05', 50),
      ],
    })
    const r = montarLinha('catalogo_place', d)
    expect(r.linhas[0].cancelada).toBe(false)
    expect(r.linhas[0].ativo).toBe(true)
    expect(r.mrrBruto).toBe(50)
  })

  it('inadimplente não conta como ativa em dia, mas segue no MRR', () => {
    const d = dados({
      clientes: [cliente('ok', 'saas'), cliente('dev', 'saas')],
      assinaturas: [sub('s1', 'cus_ok', 49.9), sub('s2', 'cus_dev', 49.9, { vencidas: 1 })],
      lancamentos: [
        lanc('ok', 'catalogo_place', '2026-10-11', 47.91),
        lanc('dev', 'catalogo_place', '2026-10-11', 47.91, { status: 'pendente' }),
      ],
    })
    const r = montarLinha('catalogo_place', d)
    expect(r.ativas).toBe(2)
    expect(r.emDia).toBe(1)
    expect(r.inadimplentes).toBe(1)
    expect(r.contagem.ativos).toBe(1)
    expect(r.mrrBruto).toBeCloseTo(99.8)
  })

  it('líquido nunca passa do bruto: usa as mesmas assinaturas', () => {
    const d = dados({
      clientes: [cliente('a', 'saas'), cliente('b', 'saas')],
      assinaturas: [sub('s1', 'cus_a', 49.9), sub('s2', 'cus_b', 49.9, { status: 'INACTIVE', removida: true })],
      lancamentos: [
        lanc('a', 'catalogo_place', '2026-10-11', 47.91, { asaas_payment_id: 'p1' }),
        lanc('b', 'catalogo_place', '2026-10-11', 47.91, { asaas_payment_id: 'p2' }),
      ],
    })
    const r = montarLinha('catalogo_place', d)
    expect(r.mrrLiquido).toBeLessThanOrEqual(r.mrrBruto)
    expect(r.mrrLiquido).toBe(47.91)
  })
})

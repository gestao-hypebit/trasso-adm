import { addMonthsISO } from '@/lib/utils'

// Métricas de cada SaaS (Catálogo Place, Clubelly): retenção por safra e
// unidade econômica (LTV, CAC, payback). Só cálculo: os dados vêm da tela.

const mesDe = (data: string) => data.slice(0, 7)
const somarMeses = (mes: string, n: number) => addMonthsISO(`${mes}-01`, n).slice(0, 7)

// ---------------------------------------------------------------
// Retenção por safra
// ---------------------------------------------------------------
export const MARCOS_RETENCAO = [1, 3, 6] as const

export type Safra = {
  mes: string            // YYYY-MM: mês da 1ª mensalidade
  clientes: number
  // Fração da safra que ainda pagava k meses depois (nulo = ainda não deu k meses).
  retencao: Record<(typeof MARCOS_RETENCAO)[number], number | null>
}

// Agrupa os assinantes pelo mês da 1ª mensalidade e vê quantos ainda tinham
// mensalidade 1, 3 e 6 meses depois. Só conta meses já fechados (o mês atual
// ainda está sendo cobrado). Quem pulou um mês e voltou conta como retido.
export function safras(
  mensalidades: { chave: string; data: string; status: string }[],
  hoje: string,
  quantas = 8,
): Safra[] {
  const mesAtual = mesDe(hoje)
  const meses = new Map<string, Set<string>>()
  for (const l of mensalidades) {
    if (l.status === 'cancelado' || mesDe(l.data) > mesAtual) continue
    const m = meses.get(l.chave) ?? new Set<string>()
    m.add(mesDe(l.data))
    meses.set(l.chave, m)
  }

  const porSafra = new Map<string, string[][]>()
  for (const ms of meses.values()) {
    const ordenados = [...ms].sort()
    const inicio = ordenados[0]
    porSafra.set(inicio, [...(porSafra.get(inicio) ?? []), ordenados])
  }

  return [...porSafra.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, quantas)
    .map(([mes, clientes]) => ({
      mes,
      clientes: clientes.length,
      retencao: Object.fromEntries(MARCOS_RETENCAO.map((k) => {
        const alvo = somarMeses(mes, k)
        if (alvo >= mesAtual) return [k, null]
        const retidos = clientes.filter((ms) => ms.some((m) => m >= alvo)).length
        return [k, retidos / clientes.length]
      })) as Safra['retencao'],
    }))
}

// ---------------------------------------------------------------
// Unidade econômica
// ---------------------------------------------------------------
// Despesas que contam como custo para conquistar cliente.
export const CUSTO_AQUISICAO_RE = /marketing|tr[aá]fego|an[uú]ncio|\bads\b|publicidade|comiss[aã]o de indica|capta[cç][aã]o/i

export type Unitario = {
  ticket: number            // líquido médio por assinante/mês
  churn: number             // churn médio mensal (0–1)
  vidaMeses: number | null  // quanto tempo um assinante fica, em média
  ltv: number | null        // quanto um assinante rende no total
  cac: number | null        // custo para conquistar um assinante
  payback: number | null    // meses para o assinante pagar o CAC
  ltvPorCac: number | null
}

export function unitario(p: { ticket: number; churn: number; custoAquisicao: number; novos: number }): Unitario {
  const vidaMeses = p.churn > 0 ? 1 / p.churn : null
  const ltv = vidaMeses !== null ? p.ticket * vidaMeses : null
  const cac = p.novos > 0 ? p.custoAquisicao / p.novos : null
  return {
    ticket: p.ticket,
    churn: p.churn,
    vidaMeses,
    ltv,
    cac,
    payback: cac !== null && p.ticket > 0 ? cac / p.ticket : null,
    ltvPorCac: ltv !== null && cac ? ltv / cac : null,
  }
}

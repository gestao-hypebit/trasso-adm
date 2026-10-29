// UTMs dos leads. O SITE já gravou sem o prefixo ({ source, campaign });
// daqui em diante grava com ({ utm_source, utm_campaign }). Aceita os dois.

export const CHAVES_UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const
export type Utm = Partial<Record<(typeof CHAVES_UTM)[number], string>>

export function normalizarUtm(utm: Record<string, unknown> | null | undefined): Utm {
  const out: Utm = {}
  if (!utm) return out
  for (const chave of CHAVES_UTM) {
    const curta = chave.replace('utm_', '')
    const valor = utm[chave] ?? utm[curta]
    if (typeof valor === 'string' && valor.trim()) out[chave] = valor.trim().slice(0, 300)
  }
  return out
}

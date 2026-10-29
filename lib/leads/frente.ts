// De qual negócio é o lead (coluna `frente` em leads). Mesmos valores do
// financeiro (lib/financeiro/linhas.ts), mas aqui a agência aparece como "Slick".

import { LINHA_CORES } from '@/lib/financeiro/linhas'

export type FrenteLead = 'agencia' | 'catalogo_place' | 'clubelly'

export const frenteLeadOpcoes: { value: FrenteLead; label: string }[] = [
  { value: 'agencia', label: 'Slick' },
  { value: 'catalogo_place', label: 'Catálogo Place' },
  { value: 'clubelly', label: 'Clubelly' },
]

export const labelFrenteLead = (v: string | null | undefined) =>
  frenteLeadOpcoes.find((o) => o.value === v)?.label ?? 'Slick'

export const corFrenteLead = (v: string | null | undefined) => LINHA_CORES[(v as FrenteLead) ?? 'agencia'] ?? LINHA_CORES.agencia

// Marca do antigo módulo de anúncios (anuncio_marcas.slug) de cada frente.
export const MARCA_DA_FRENTE: Record<FrenteLead, string> = {
  agencia: 'slick',
  catalogo_place: 'catalogo-place',
  clubelly: 'clubelly',
}

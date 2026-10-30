import { somarDias } from '@/lib/anuncios/regras'

export type MetaDiaria = {
  id: string
  titulo: string
  alvo: number
  unidade: string
  // 0 = domingo ... 6 = sábado
  dias_semana: number[]
  cor: string
  ordem: number
  ativa: boolean
  created_at: string
}

export type RegistroDiario = { meta_id: string; data: string; quantidade: number }

// Quanto foi feito por meta e dia: feito[meta_id][dia].
export type Feito = Record<string, Record<string, number>>

export const DIAS_SEMANA = [
  { value: 0, curto: 'D', label: 'Dom' },
  { value: 1, curto: 'S', label: 'Seg' },
  { value: 2, curto: 'T', label: 'Ter' },
  { value: 3, curto: 'Q', label: 'Qua' },
  { value: 4, curto: 'Q', label: 'Qui' },
  { value: 5, curto: 'S', label: 'Sex' },
  { value: 6, curto: 'S', label: 'Sáb' },
]

// Mesma paleta das frentes em /metas, mais o rosa e o amarelo.
export const CORES_META = ['#8B5CF6', '#2BA3D6', '#76A000', '#E0457B', '#E0A800']

export const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay()

export const valeNoDia = (meta: Pick<MetaDiaria, 'dias_semana'>, dia: string) =>
  meta.dias_semana.includes(diaDaSemana(dia))

export function agruparFeito(registros: RegistroDiario[]): Feito {
  const feito: Feito = {}
  for (const r of registros) (feito[r.meta_id] ??= {})[r.data] = r.quantidade
  return feito
}

// Dias seguidos batendo a meta, contando só os dias em que ela vale.
// Hoje ainda em andamento não quebra a sequência: só conta se já bateu.
export function sequencia(meta: Pick<MetaDiaria, 'alvo' | 'dias_semana'>, feito: Record<string, number>, hoje: string, limite = 365) {
  if (meta.dias_semana.length === 0) return 0
  let total = 0
  for (let i = 0; i < limite; i++) {
    const dia = somarDias(hoje, -i)
    if (!valeNoDia(meta, dia)) continue
    const bateu = (feito[dia] ?? 0) >= meta.alvo
    if (bateu) total++
    else if (i > 0) break
  }
  return total
}

// Últimos n dias terminando em `ate`, do mais antigo para o mais novo.
export const ultimosDias = (n: number, ate: string) =>
  Array.from({ length: n }, (_, i) => somarDias(ate, i - n + 1))

// Resumo de um período: em quantos dias a meta valia, em quantos bateu e o total feito.
export function resumirPeriodo(meta: Pick<MetaDiaria, 'alvo' | 'dias_semana'>, feito: Record<string, number>, dias: string[]) {
  const validos = dias.filter((d) => valeNoDia(meta, d))
  const batidos = validos.filter((d) => (feito[d] ?? 0) >= meta.alvo).length
  const total = dias.reduce((s, d) => s + (feito[d] ?? 0), 0)
  return {
    validos: validos.length,
    batidos,
    total,
    taxa: validos.length ? batidos / validos.length : null,
    media: validos.length ? total / validos.length : null,
  }
}

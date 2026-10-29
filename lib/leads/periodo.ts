// Filtro de período da tela de leads (pela data em que o lead chegou).
// Dias no formato YYYY-MM-DD, no fuso de São Paulo, com as duas pontas incluídas.

import { somarDias } from '@/lib/anuncios/regras'

export type PeriodoChave = 'tudo' | 'hoje' | '7d' | '30d' | 'mes' | 'mes_passado' | '90d' | 'personalizado'
export type Intervalo = { de: string | null; ate: string | null }

export const periodoOpcoes: { value: PeriodoChave; label: string }[] = [
  { value: 'tudo', label: 'Todo período' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'mes', label: 'Este mês' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: '90d', label: '90 dias' },
  { value: 'personalizado', label: 'Personalizado' },
]

const ultimoDiaDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate() // mes 1-12

export function intervaloDoPeriodo(chave: PeriodoChave, hoje: string, custom: Intervalo = { de: null, ate: null }): Intervalo {
  const [ano, mes] = hoje.split('-').map(Number)
  switch (chave) {
    case 'hoje': return { de: hoje, ate: hoje }
    case '7d': return { de: somarDias(hoje, -6), ate: hoje }
    case '30d': return { de: somarDias(hoje, -29), ate: hoje }
    case '90d': return { de: somarDias(hoje, -89), ate: hoje }
    case 'mes': return { de: `${hoje.slice(0, 7)}-01`, ate: hoje }
    case 'mes_passado': {
      const a = mes === 1 ? ano - 1 : ano
      const m = mes === 1 ? 12 : mes - 1
      const mm = String(m).padStart(2, '0')
      return { de: `${a}-${mm}-01`, ate: `${a}-${mm}-${String(ultimoDiaDoMes(a, m)).padStart(2, '0')}` }
    }
    case 'personalizado': {
      // Datas invertidas não zeram a tela: troca as pontas.
      if (custom.de && custom.ate && custom.de > custom.ate) return { de: custom.ate, ate: custom.de }
      return custom
    }
    default: return { de: null, ate: null }
  }
}

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000)

// Período imediatamente antes, com a mesma duração (para comparar). Sem as duas pontas, não há comparação.
export function intervaloAnterior({ de, ate }: Intervalo): Intervalo | null {
  if (!de || !ate) return null
  const dias = diasEntre(de, ate) + 1
  return { de: somarDias(de, -dias), ate: somarDias(de, -1) }
}

export const noIntervalo = (dia: string, { de, ate }: Intervalo) => (!de || dia >= de) && (!ate || dia <= ate)

// Variação percentual inteira; null quando não dá para comparar.
export function variacao(atual: number, anterior: number) {
  if (!anterior) return null
  return Math.round(((atual - anterior) / anterior) * 100)
}

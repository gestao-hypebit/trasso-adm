import { toISODateLocal } from '@/lib/utils'

// Em lançamentos pendentes, o campo `data` funciona como data de vencimento.

export type Situacao = 'vencido' | 'hoje' | 'a_vencer' | 'liquidado' | 'cancelado'

export function hojeISO(): string {
  return toISODateLocal(new Date())
}

// Diferença em dias entre duas datas YYYY-MM-DD (b - a), sem efeito de fuso.
export function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000)
}

export function situacaoDe(status: string, vencimento: string, hoje = hojeISO()): Situacao {
  if (status === 'cancelado') return 'cancelado'
  if (status !== 'pendente') return 'liquidado'
  if (vencimento < hoje) return 'vencido'
  if (vencimento === hoje) return 'hoje'
  return 'a_vencer'
}

export const FAIXAS_AGING = [
  { key: 'a_vencer', label: 'A vencer', min: -Infinity, max: 0 },
  { key: '1_30', label: '1–30 dias', min: 1, max: 30 },
  { key: '31_60', label: '31–60 dias', min: 31, max: 60 },
  { key: '61_90', label: '61–90 dias', min: 61, max: 90 },
  { key: '90_mais', label: '+90 dias', min: 91, max: Infinity },
] as const

// Agrupa títulos em aberto por dias de atraso.
export function aging<T extends { valor: number; data: string }>(abertos: T[], hoje = hojeISO()) {
  return FAIXAS_AGING.map((f) => {
    const itens = abertos.filter((l) => {
      const atraso = diasEntre(l.data, hoje)
      return atraso >= f.min && atraso <= f.max
    })
    return { ...f, qtd: itens.length, valor: itens.reduce((s, l) => s + l.valor, 0) }
  })
}

export function baixarCSV(nome: string, cabecalho: string[], linhas: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // `;` e BOM para o Excel em pt-BR abrir direto com acentos e colunas certas.
  const csv = '﻿' + [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

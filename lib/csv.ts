// CSV compatível com Excel em português: separador ";" e BOM UTF-8 na exportação.

export function toCSV(header: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
}

export function downloadCSV(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

// Detecta ";" ou "," pela primeira linha e respeita campos entre aspas.
export function parseCSV(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '')
  const primeiraLinha = t.split(/\r?\n/, 1)[0] ?? ''
  const sep = (primeiraLinha.match(/;/g)?.length ?? 0) >= (primeiraLinha.match(/,/g)?.length ?? 0) ? ';' : ','

  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let aspas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') {
      aspas = true
    } else if (c === sep) {
      linha.push(campo); campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some((v) => v.trim() !== '')) linhas.push(linha)
      linha = []
    } else {
      campo += c
    }
  }
  linha.push(campo)
  if (linha.some((v) => v.trim() !== '')) linhas.push(linha)
  return linhas
}

// Normaliza cabeçalhos ("E-mail", "email", "Email " → "email").
export function normalizarCabecalho(h: string): string {
  return h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// Chave de API de cada site de cliente. Só o hash vai para o banco; a chave
// em si aparece uma vez na tela, para colar na variável de ambiente do site.
// Usa Web Crypto, então roda tanto no navegador (gerar) quanto no servidor (conferir).

export const PREFIXO_CHAVE = 'slk_'

export function gerarChave(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return PREFIXO_CHAVE + b64
}

export async function hashChave(chave: string): Promise<string> {
  const dados = new TextEncoder().encode(chave)
  const hash = await crypto.subtle.digest('SHA-256', dados)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// O que aparece na tela para reconhecer a chave (ex.: "slk_Ab3x…").
export function prefixoVisivel(chave: string) {
  return chave.slice(0, PREFIXO_CHAVE.length + 4)
}

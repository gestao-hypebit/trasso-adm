'use server'

import { redirect } from 'next/navigation'
import { confirmarCodigo, encerrarSessao, gerarCodigo } from '@/lib/cliente-auth/sessao'
import { enviarCodigoPorEmail } from '@/lib/cliente-auth/email'

export type RespostaEntrar = { ok: true } | { ok: false; erro: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function pedirCodigo(email: string): Promise<RespostaEntrar> {
  if (!EMAIL_RE.test(email.trim())) return { ok: false, erro: 'Digite um e-mail válido.' }
  try {
    const r = await gerarCodigo(email)
    if (!r.ok) return r
    // Sem acesso: responde igual, para não revelar quais e-mails existem.
    if (r.codigo && !(await enviarCodigoPorEmail(email.trim().toLowerCase(), r.codigo))) {
      return { ok: false, erro: 'Não conseguimos enviar o e-mail agora. Tente de novo em instantes.' }
    }
    return { ok: true }
  } catch (e) {
    console.error('[entrar] pedir código', e)
    return { ok: false, erro: 'Algo deu errado. Tente de novo.' }
  }
}

export async function entrarComCodigo(email: string, codigo: string): Promise<RespostaEntrar> {
  let r: RespostaEntrar
  try {
    r = await confirmarCodigo(email, codigo)
  } catch (e) {
    console.error('[entrar] confirmar código', e)
    return { ok: false, erro: 'Algo deu errado. Tente de novo.' }
  }
  if (!r.ok) return r
  redirect('/meu-site')
}

export async function sair() {
  await encerrarSessao()
  redirect('/entrar')
}

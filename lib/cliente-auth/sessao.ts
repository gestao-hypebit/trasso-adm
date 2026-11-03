import 'server-only'
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'

// Login do cliente (área /meu-site). NÃO é o Supabase Auth: ver a migration
// 20261111000000_cliente_login_conteudo.sql. Tudo aqui usa a service role e
// só roda no servidor.

export const COOKIE_CLIENTE = 'slick_cliente'
const SESSAO_DIAS = 30
const CODIGO_MINUTOS = 10
const MAX_TENTATIVAS = 5
const MAX_CODIGOS_JANELA = 3       // pedidos de código por e-mail...
const JANELA_MINUTOS = 15          // ...nesta janela

export type ClienteAcesso = {
  acessoId: string
  email: string
  nome: string | null
  clienteId: string
  clienteNome: string
  clienteEmpresa: string | null
  portalToken: string | null
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const db = () => createServiceClient() as any

export function normalizarEmail(email: string) {
  return email.trim().toLowerCase().slice(0, 200)
}

// ------------------------------------------------------------------
// Código por e-mail
// ------------------------------------------------------------------

export type PedidoCodigo = { ok: true; codigo: string | null } | { ok: false; erro: string }

// Gera o código se o e-mail tiver acesso ativo. Para quem não tem acesso,
// responde ok sem código: a tela não pode revelar quais e-mails existem.
export async function gerarCodigo(emailBruto: string): Promise<PedidoCodigo> {
  const email = normalizarEmail(emailBruto)
  const supabase = db()

  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000).toISOString()
  const { count } = await supabase.from('cliente_codigos').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', desde)
  if ((count ?? 0) >= MAX_CODIGOS_JANELA) {
    return { ok: false, erro: `Muitos pedidos seguidos. Espere ${JANELA_MINUTOS} minutos e tente de novo.` }
  }

  const { data: acesso } = await supabase.from('cliente_acessos').select('id').eq('email', email).eq('ativo', true).maybeSingle()
  if (!acesso) return { ok: true, codigo: null }

  // Um código válido por vez.
  await supabase.from('cliente_codigos').update({ usado: true }).eq('email', email).eq('usado', false)

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const { error } = await supabase.from('cliente_codigos').insert({
    email,
    codigo_hash: sha256(`${email}:${codigo}`),
    expira_em: new Date(Date.now() + CODIGO_MINUTOS * 60_000).toISOString(),
  })
  if (error) throw error
  return { ok: true, codigo }
}

export type ConfirmacaoCodigo = { ok: true } | { ok: false; erro: string }

export async function confirmarCodigo(emailBruto: string, codigoBruto: string): Promise<ConfirmacaoCodigo> {
  const email = normalizarEmail(emailBruto)
  const codigo = codigoBruto.replace(/\D/g, '')
  const invalido = { ok: false as const, erro: 'Código inválido ou vencido. Peça um novo.' }
  if (codigo.length !== 6) return invalido

  const supabase = db()
  const { data: registro } = await supabase
    .from('cliente_codigos')
    .select('id, codigo_hash, expira_em, tentativas')
    .eq('email', email)
    .eq('usado', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!registro || new Date(registro.expira_em) < new Date() || registro.tentativas >= MAX_TENTATIVAS) return invalido

  const esperado = Buffer.from(registro.codigo_hash)
  const recebido = Buffer.from(sha256(`${email}:${codigo}`))
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
    const tentativas = registro.tentativas + 1
    await supabase.from('cliente_codigos').update({ tentativas, usado: tentativas >= MAX_TENTATIVAS }).eq('id', registro.id)
    return tentativas >= MAX_TENTATIVAS ? { ok: false, erro: 'Tentativas demais. Peça um novo código.' } : { ok: false, erro: 'Código incorreto.' }
  }

  await supabase.from('cliente_codigos').update({ usado: true }).eq('id', registro.id)

  const { data: acesso } = await supabase.from('cliente_acessos').select('id').eq('email', email).eq('ativo', true).maybeSingle()
  if (!acesso) return invalido

  const token = randomBytes(32).toString('base64url')
  const expira = new Date(Date.now() + SESSAO_DIAS * 86_400_000)
  const { error } = await supabase.from('cliente_sessoes').insert({ acesso_id: acesso.id, token_hash: sha256(token), expira_em: expira.toISOString() })
  if (error) throw error
  await supabase.from('cliente_acessos').update({ ultimo_acesso: new Date().toISOString() }).eq('id', acesso.id)

  const jar = await cookies()
  jar.set(COOKIE_CLIENTE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expira,
  })
  return { ok: true }
}

// ------------------------------------------------------------------
// Sessão atual
// ------------------------------------------------------------------

export const getClienteLogado = cache(async (): Promise<ClienteAcesso | null> => {
  const token = (await cookies()).get(COOKIE_CLIENTE)?.value
  if (!token || token.length > 100) return null

  const { data } = await db()
    .from('cliente_sessoes')
    .select('expira_em, cliente_acessos!inner(id, email, nome, ativo, clientes!inner(id, nome, empresa, portal_token, portal_ativo))')
    .eq('token_hash', sha256(token))
    .maybeSingle()
  if (!data || new Date(data.expira_em) < new Date()) return null
  const a = data.cliente_acessos
  if (!a?.ativo || !a.clientes) return null

  return {
    acessoId: a.id,
    email: a.email,
    nome: a.nome,
    clienteId: a.clientes.id,
    clienteNome: a.clientes.nome,
    clienteEmpresa: a.clientes.empresa,
    portalToken: a.clientes.portal_ativo ? a.clientes.portal_token : null,
  }
})

export async function encerrarSessao() {
  const jar = await cookies()
  const token = jar.get(COOKIE_CLIENTE)?.value
  if (token) await db().from('cliente_sessoes').delete().eq('token_hash', sha256(token))
  jar.delete(COOKIE_CLIENTE)
}

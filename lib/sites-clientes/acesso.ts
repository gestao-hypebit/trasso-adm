import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getClienteLogado } from '@/lib/cliente-auth/sessao'

// Quem pode mexer num site: alguém da equipe (login do administrativo) ou o
// cliente dono do site (login da área do cliente). Toda server action do
// editor passa por aqui antes de ler ou gravar com a service role.
//
// A mesma pessoa pode estar com os dois logins no navegador (ex.: a equipe
// testando a área do cliente). Por isso quem chama diz qual papel prefere:
// as telas da equipe preferem "equipe", as de /meu-site preferem "cliente".
// Se o papel preferido não tiver acesso ao site, vale o outro.

export type Papel = 'equipe' | 'cliente'

export type Editor =
  | { tipo: 'equipe'; nome: string }
  | { tipo: 'cliente'; nome: string; clienteId: string }

export type SiteAutorizado = {
  id: string
  cliente_id: string
  nome: string
  dominio: string | null
  ativo: boolean
  chave_hash: string | null
}

async function editorEquipe(): Promise<Editor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle() as { data: { nome: string | null } | null }
  return { tipo: 'equipe', nome: perfil?.nome || user.email || 'Equipe Slick' }
}

async function editorCliente(): Promise<Editor | null> {
  const cliente = await getClienteLogado()
  return cliente ? { tipo: 'cliente', nome: cliente.nome || cliente.email, clienteId: cliente.clienteId } : null
}

export async function autorizarSite(siteId: string, preferir: Papel = 'equipe'): Promise<{ editor: Editor; site: SiteAutorizado } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return null

  const { data: site } = await (createServiceClient() as any)
    .from('sites_clientes')
    .select('id, cliente_id, nome, dominio, ativo, chave_hash')
    .eq('id', siteId)
    .maybeSingle()
  if (!site) return null

  const ordem = preferir === 'cliente' ? [editorCliente, editorEquipe] : [editorEquipe, editorCliente]
  for (const obter of ordem) {
    const editor = await obter()
    if (!editor) continue
    if (editor.tipo === 'equipe') return { editor, site: site as SiteAutorizado }
    if (site.cliente_id === editor.clienteId && site.ativo) return { editor, site: site as SiteAutorizado }
  }
  return null
}

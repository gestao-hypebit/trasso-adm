import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getClienteLogado } from '@/lib/cliente-auth/sessao'

// Quem pode mexer num site: alguém da equipe (login do administrativo) ou o
// cliente dono do site (login da área do cliente). Toda server action do
// editor passa por aqui antes de ler ou gravar com a service role.

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

export async function editorAtual(): Promise<Editor | null> {
  const cliente = await getClienteLogado()
  if (cliente) return { tipo: 'cliente', nome: cliente.nome || cliente.email, clienteId: cliente.clienteId }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle() as { data: { nome: string | null } | null }
  return { tipo: 'equipe', nome: perfil?.nome || user.email || 'Equipe Slick' }
}

export async function autorizarSite(siteId: string): Promise<{ editor: Editor; site: SiteAutorizado } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return null
  const editor = await editorAtual()
  if (!editor) return null

  const { data: site } = await (createServiceClient() as any)
    .from('sites_clientes')
    .select('id, cliente_id, nome, dominio, ativo, chave_hash')
    .eq('id', siteId)
    .maybeSingle()
  if (!site) return null
  if (editor.tipo === 'cliente' && (site.cliente_id !== editor.clienteId || !site.ativo)) return null
  return { editor, site: site as SiteAutorizado }
}

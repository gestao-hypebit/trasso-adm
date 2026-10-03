import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Rotas do painel que mexem na integração: só usuário logado.
export async function usuarioLogado() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
}

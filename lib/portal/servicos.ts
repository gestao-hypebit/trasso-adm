import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export type ServicoContratado = { id: string; nome: string; categoria: string | null }

type ItemRow = {
  descricao: string
  servicos: ServicoContratado | null
  propostas: { cliente_id: string | null; status: string } | null
}

export async function getServicosContratados(clienteId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('proposta_itens')
    .select('descricao, servicos(id, nome, categoria), propostas!inner(cliente_id, status)')
    .eq('propostas.cliente_id', clienteId)
    .eq('propostas.status', 'aprovada')
    .returns<ItemRow[]>()

  const porId = new Map<string, ServicoContratado>()
  const extras = new Set<string>()

  for (const item of data ?? []) {
    if (item.servicos) porId.set(item.servicos.id, item.servicos)
    else extras.add(item.descricao)
  }

  return { servicos: [...porId.values()], extras: [...extras] }
}

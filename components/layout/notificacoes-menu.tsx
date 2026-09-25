'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative } from '@/lib/utils'

type Notificacao = { id: string; titulo: string; mensagem: string | null; tipo: string | null; lida: boolean; link: string | null; created_at: string }

const corTipo: Record<string, string> = {
  sucesso: 'bg-brand-lima', alerta: 'bg-yellow-400', erro: 'bg-brand-rosa', info: 'bg-brand-violeta',
}

export function NotificacoesMenu() {
  const router = useRouter()
  const [itens, setItens] = useState<Notificacao[]>([])

  useEffect(() => {
    const supabase = createClient() as any
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      let query = supabase.from('notificacoes')
        .select('id, titulo, mensagem, tipo, lida, link, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      query = user ? query.or(`usuario_id.is.null,usuario_id.eq.${user.id}`) : query.is('usuario_id', null)
      const { data } = await query
      setItens(data ?? [])
    }
    load()
  }, [])

  const naoLidas = itens.filter((n) => !n.lida)

  async function marcarLidas(ids: string[]) {
    if (ids.length === 0) return
    setItens((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, lida: true } : n)))
    await (createClient() as any).from('notificacoes').update({ lida: true }).in('id', ids)
  }

  function abrir(n: Notificacao) {
    marcarLidas([n.id])
    if (n.link) router.push(n.link)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {naoLidas.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-lima" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
          <span className="text-sm font-semibold">Notificações</span>
          {naoLidas.length > 0 && (
            <button onClick={() => marcarLidas(naoLidas.map((n) => n.id))} className="flex items-center gap-1 text-xs text-brand-lavanda/50 hover:text-brand-lavanda">
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {itens.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-brand-lavanda/40">Nada por aqui ainda. Aprovações e assinaturas do portal aparecem aqui.</p>
          ) : itens.map((n) => (
            <DropdownMenuItem key={n.id} onSelect={() => abrir(n)} className="items-start gap-2.5 py-2.5 cursor-pointer">
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.lida ? 'bg-white/[0.1]' : corTipo[n.tipo ?? 'info'] ?? 'bg-brand-violeta')} />
              <div className="min-w-0">
                <p className={cn('text-xs font-medium', n.lida ? 'text-brand-lavanda/50' : 'text-brand-lavanda')}>{n.titulo}</p>
                {n.mensagem && <p className="text-[11px] text-brand-lavanda/50 mt-0.5">{n.mensagem}</p>}
                <p className="text-[10px] text-brand-lavanda/30 mt-1">{formatRelative(n.created_at)}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

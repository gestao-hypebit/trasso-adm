'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Loader2, UserRound } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BriefingPainel } from '@/components/social/briefing-painel'
import { createClient } from '@/lib/supabase/client'
import { STATUS_PLANEJAMENTO, nomePeriodo } from '@/lib/social/tipos'

type Cliente = { id: string; nome: string; empresa: string | null; telefone: string | null; whatsapp: string | null }
type Plano = { id: string; mes: string; data_fim: string | null; status: string; social_posts: { aprovacao: string }[] }

// Página do cliente dentro de Social media: briefing + planejamentos dele.
export function ClienteSocial({ id }: { id: string }) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [planos, setPlanos] = useState<Plano[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const db = createClient() as any
    Promise.all([
      db.from('clientes').select('id, nome, empresa, telefone, whatsapp').eq('id', id).maybeSingle(),
      db.from('social_planejamentos').select('id, mes, data_fim, status, social_posts(aprovacao)').eq('cliente_id', id).order('mes', { ascending: false }),
    ]).then(([c, p]: { data: any; error: { message: string } | null }[]) => {
      if (c.error || !c.data) { setErro(c.error?.message ?? 'Cliente não encontrado.'); return }
      setCliente(c.data)
      setPlanos(p.data ?? [])
    })
  }, [id])

  if (!cliente) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-brand-lavanda/40">{erro ?? <Loader2 className="h-5 w-5 animate-spin" />}</div>
  }

  const nomeCliente = cliente.empresa || cliente.nome

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Social media" description={nomeCliente} />

      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3 md:px-6">
        <Link href="/social?aba=clientes" className="mr-1 rounded-md p-1 text-brand-lavanda/40 hover:bg-white/[0.06] hover:text-brand-lavanda" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
        <h1 className="mr-1 truncate text-base font-semibold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{nomeCliente}</h1>
        {cliente.empresa && cliente.empresa !== cliente.nome && <span className="text-sm text-brand-lavanda/50">{cliente.nome}</span>}
        <div className="ml-auto">
          <Button size="sm" variant="ghost" asChild><Link href={`/clientes/${cliente.id}`}><UserRound className="h-3.5 w-3.5" /> Ficha do cliente</Link></Button>
        </div>
      </div>

      <main className="grid flex-1 gap-5 p-4 md:p-6 xl:grid-cols-[1fr_300px]">
        <section className="min-w-0">
          <BriefingPainel cliente={cliente} />
        </section>

        <aside>
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-lavanda/40">Planejamentos</p>
              {planos.length === 0 && <p className="text-xs text-brand-lavanda/40">Nenhum planejamento ainda. Crie em <Link href="/social" className="underline hover:text-brand-lavanda">Social media</Link>.</p>}
              {planos.map((p) => {
                const st = STATUS_PLANEJAMENTO[p.status] ?? STATUS_PLANEJAMENTO.rascunho
                return (
                  <Link key={p.id} href={`/social/${p.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/[0.04]">
                    <span className="min-w-0">
                      <span className="block truncate text-brand-lavanda/80">{nomePeriodo(p.mes, p.data_fim)}</span>
                      <span className="flex items-center gap-1 text-[11px] text-brand-lavanda/40"><CalendarDays className="h-3 w-3" /> {p.social_posts.length} post{p.social_posts.length === 1 ? '' : 's'}</span>
                    </span>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  )
}

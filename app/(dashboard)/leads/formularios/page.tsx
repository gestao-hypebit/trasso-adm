'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, LayoutList } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { LeadsSubNav } from '@/components/leads/leads-sub-nav'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { formatRelative } from '@/lib/utils'
import { camposPadrao, type Formulario } from '@/lib/leads/formulario'

type Item = Pick<Formulario, 'id' | 'slug' | 'nome' | 'ativo' | 'campos' | 'updated_at'> & { leads: { count: number }[] }

export default function FormulariosPage() {
  const router = useRouter()
  const [itens, setItens] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await (createClient() as any)
        .from('formularios')
        .select('id, slug, nome, ativo, campos, updated_at, leads(count)')
        .order('created_at')
      setItens((data as Item[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function criar() {
    setCriando(true)
    setErro(null)
    const sufixo = Math.random().toString(36).slice(2, 6)
    const { data, error } = await (createClient() as any)
      .from('formularios')
      .insert({ slug: `formulario-${sufixo}`, nome: 'Novo formulário', titulo: 'Fale com a gente', campos: camposPadrao() })
      .select('id')
      .single()
    if (error || !data) {
      setErro('Não foi possível criar o formulário. A migration de leads já foi aplicada no Supabase?')
      setCriando(false)
      return
    }
    router.push(`/leads/formularios/${data.id}`)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Formulários" description="Formulários de captação do site" />

      <main className="flex-1 p-4 md:p-6">
        <LeadsSubNav />
        <PageHeader title="Formulários" description="Monte aqui os campos que aparecem no site. As mudanças entram no ar em até 1 minuto.">
          <Button onClick={criar} disabled={criando}>
            <Plus className="h-4 w-4" /> Novo formulário
          </Button>
        </PageHeader>
        {erro && <p className="mb-4 text-xs text-brand-rosa">{erro}</p>}

        {loading ? (
          <p className="py-16 text-center text-sm text-brand-lavanda/40">Carregando...</p>
        ) : itens.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <LayoutList className="h-10 w-10 text-brand-lavanda/20 mx-auto mb-3" />
              <p className="text-sm text-brand-lavanda/40">Nenhum formulário ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {itens.map((f) => (
              <Link key={f.id} href={`/leads/formularios/${f.id}`}>
                <Card className="h-full transition-colors hover:border-brand-lima/40">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-brand-lavanda">{f.nome}</p>
                      <Badge variant={f.ativo ? 'ativo' : 'inativo'}>{f.ativo ? 'No ar' : 'Pausado'}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-brand-lavanda/40">{f.slug}</p>
                    <div className="mt-4 flex gap-4 text-xs text-brand-lavanda/60">
                      <span>{f.campos?.length ?? 0} campos</span>
                      <span>{f.leads?.[0]?.count ?? 0} leads</span>
                      <span className="ml-auto text-brand-lavanda/40">editado {formatRelative(f.updated_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

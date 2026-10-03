'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, Globe, Plus, Search } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { STATUS_PREVIA } from '@/lib/sites/tipos'
import { formatDate } from '@/lib/utils'

type Linha = {
  id: string; nome: string; slug: string; status: string; publicada: boolean
  visualizacoes: number; ultima_visualizacao: string | null; created_at: string; versao_atual: number
  briefing: { segmento?: string; logoUrl?: string; corPrimaria?: string }
  clientes: { nome: string } | null
  leads: { nome: string } | null
}

export default function SitesPage() {
  const [previas, setPrevias] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    (createClient() as any)
      .from('site_previas')
      .select('id, nome, slug, status, publicada, visualizacoes, ultima_visualizacao, created_at, versao_atual, briefing, clientes(nome), leads(nome)')
      .order('created_at', { ascending: false })
      .then(({ data, error }: { data: Linha[] | null; error: { code?: string; message: string } | null }) => {
        if (error) setErro(error.code === '42P01' ? 'Rode a migration 20261009000000_sites_previas.sql no Supabase antes de usar.' : error.message)
        setPrevias(data ?? [])
        setLoading(false)
      })
  }, [])

  const termo = busca.toLowerCase()
  const visiveis = previas.filter((p) => !termo || [p.nome, p.clientes?.nome, p.leads?.nome, p.briefing?.segmento].some((v) => v?.toLowerCase().includes(termo)))

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Prévias de site" description="Sites gerados por IA para apresentar a clientes" />
      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="Prévias de site" description="Monte em minutos uma prévia do site do cliente e mande o link para fechar o projeto.">
          <Button size="sm" asChild><Link href="/sites/novo"><Plus className="h-4 w-4" /> Nova prévia</Link></Button>
        </PageHeader>

        {erro && <p className="mb-4 text-sm text-brand-rosa">{erro}</p>}

        {previas.length > 0 && (
          <div className="relative mb-5 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-lavanda/40" />
            <Input className="pl-9" placeholder="Buscar por empresa, cliente ou segmento..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        )}

        {loading ? (
          <p className="py-20 text-center text-sm text-brand-lavanda/40">Carregando...</p>
        ) : previas.length === 0 && !erro ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Globe className="h-8 w-8 text-brand-lima" />
              <p className="text-base font-medium text-brand-lavanda">Nenhuma prévia ainda</p>
              <p className="max-w-md text-sm text-brand-lavanda/50">Preencha o briefing de uma empresa, a IA escreve os textos e monta o site. Você ajusta e manda o link para o cliente.</p>
              <Button asChild className="mt-2"><Link href="/sites/novo"><Plus className="h-4 w-4" /> Criar a primeira</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visiveis.map((p) => {
              const st = STATUS_PREVIA[p.status] ?? STATUS_PREVIA.rascunho
              const vinculo = p.clientes?.nome ?? p.leads?.nome
              return (
                <Link key={p.id} href={`/sites/${p.id}`} className="group">
                  <Card className="h-full transition-colors group-hover:border-white/[0.16]">
                    <CardContent className="flex h-full flex-col gap-3 p-5">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08]"
                          style={{ background: p.briefing?.corPrimaria ?? 'rgba(255,255,255,0.04)' }}
                        >
                          {p.briefing?.logoUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={p.briefing.logoUrl} alt="" className="h-full w-full bg-white object-contain p-1" />
                            : <span className="text-sm font-bold text-white">{p.nome.slice(0, 1).toUpperCase()}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-brand-lavanda group-hover:text-brand-lima">{p.nome}</p>
                          <p className="truncate text-xs text-brand-lavanda/40">{[p.briefing?.segmento, vinculo].filter(Boolean).join(' · ') || 'Prospecção'}</p>
                        </div>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <div className="mt-auto flex items-center justify-between text-xs text-brand-lavanda/40">
                        <span>Criada em {formatDate(p.created_at)}{p.versao_atual > 0 && ` · v${p.versao_atual}`}</span>
                        {p.status === 'pronto' && (
                          <span className={p.visualizacoes > 0 ? 'flex items-center gap-1 text-brand-lima/80' : 'flex items-center gap-1'} title={p.ultima_visualizacao ? `Última: ${formatDate(p.ultima_visualizacao, 'dd/MM/yyyy HH:mm')}` : 'Ainda não abriram o link'}>
                            <Eye className="h-3.5 w-3.5" /> {p.visualizacoes}
                            {!p.publicada && <span className="text-brand-rosa/70"> · link desligado</span>}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

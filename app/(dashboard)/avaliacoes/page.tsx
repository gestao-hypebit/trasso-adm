'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, Copy, Check, ThumbsUp, MessageSquareQuote, Clock, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PortalLinkAcoes, type ClientePortal } from '@/components/projetos/portal-link-acoes'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'

type Avaliacao = {
  id: string
  status: 'pendente' | 'respondida'
  nota: number | null
  comentario: string | null
  depoimento: string | null
  autoriza_publicar: boolean
  nome_exibicao: string | null
  cargo_empresa: string | null
  destaque: boolean
  solicitada_em: string
  respondida_em: string | null
  cliente_id: string
  projeto_id: string | null
  clientes: (ClientePortal & { empresa: string | null }) | null
  projetos: { nome: string } | null
}

const categoria = (nota: number) => (nota >= 9 ? 'promotor' : nota >= 7 ? 'neutro' : 'detrator')
const corNota = { promotor: 'text-brand-lima', neutro: 'text-yellow-400', detrator: 'text-brand-rosa' }

function CopiarDepoimento({ a }: { a: Avaliacao }) {
  const [ok, setOk] = useState(false)
  async function copiar() {
    const assinatura = [a.nome_exibicao, a.cargo_empresa].filter(Boolean).join(', ')
    await navigator.clipboard.writeText(`"${a.depoimento}"${assinatura ? `\n— ${assinatura}` : ''}`)
    setOk(true)
    setTimeout(() => setOk(false), 2000)
  }
  return (
    <Button size="sm" variant="ghost" onClick={copiar}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {ok ? 'Copiado' : 'Copiar'}
    </Button>
  )
}

export default function AvaliacoesPage() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await (createClient() as any)
        .from('avaliacoes')
        .select('*, clientes(nome, empresa, telefone, whatsapp, portal_token, portal_ativo), projetos(nome)')
        .order('solicitada_em', { ascending: false })
      if (error) setErro('Não foi possível carregar. A migration de avaliações já foi aplicada no Supabase?')
      setAvaliacoes((data as Avaliacao[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function alternarDestaque(a: Avaliacao) {
    setAvaliacoes((prev) => prev.map((x) => (x.id === a.id ? { ...x, destaque: !a.destaque } : x)))
    const { error } = await (createClient() as any).from('avaliacoes').update({ destaque: !a.destaque }).eq('id', a.id)
    if (error) setAvaliacoes((prev) => prev.map((x) => (x.id === a.id ? a : x)))
  }

  // Primeiro clique arma, segundo apaga (mesmo padrão do lead).
  const [confirmarId, setConfirmarId] = useState<string | null>(null)
  async function excluir(a: Avaliacao) {
    if (confirmarId !== a.id) { setConfirmarId(a.id); return }
    setConfirmarId(null)
    const { error } = await (createClient() as any).from('avaliacoes').delete().eq('id', a.id)
    if (error) setErro(`Não foi possível excluir: ${error.message}`)
    else setAvaliacoes((prev) => prev.filter((x) => x.id !== a.id))
  }
  const BotaoExcluir = ({ a }: { a: Avaliacao }) => (
    <Button size="sm" variant="ghost" onClick={() => excluir(a)} className="text-brand-lavanda/40 hover:text-brand-rosa" aria-label="Excluir avaliação">
      <Trash2 className="h-3.5 w-3.5" />{confirmarId === a.id && ' Clique de novo'}
    </Button>
  )

  const respondidas = avaliacoes.filter((a) => a.status === 'respondida' && a.nota !== null)
  const pendentes = avaliacoes.filter((a) => a.status === 'pendente')
  const conta = (c: string) => respondidas.filter((a) => categoria(a.nota!) === c).length
  const nps = respondidas.length ? Math.round(((conta('promotor') - conta('detrator')) / respondidas.length) * 100) : null
  const media = respondidas.length ? respondidas.reduce((s, a) => s + a.nota!, 0) / respondidas.length : null
  const depoimentos = respondidas
    .filter((a) => a.depoimento && a.autoriza_publicar)
    .sort((a, b) => Number(b.destaque) - Number(a.destaque))

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Avaliações" description="NPS e depoimentos dos clientes" />

      <main className="flex-1 p-4 md:p-6">
        <PageHeader
          title="Avaliações"
          description="O pedido aparece no portal do cliente quando o projeto é marcado como concluído."
        />

        {erro && <p className="mb-4 text-sm text-brand-rosa">{erro}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="NPS" value={nps === null ? '—' : String(nps)} icon={ThumbsUp} iconColor={nps !== null && nps >= 50 ? 'text-brand-lima' : 'text-brand-lavanda/40'} />
              <KpiCard title="Nota média" value={media === null ? '—' : media.toFixed(1).replace('.', ',')} icon={Star} />
              <KpiCard title="Depoimentos liberados" value={String(depoimentos.length)} icon={MessageSquareQuote} />
              <KpiCard title="Aguardando resposta" value={String(pendentes.length)} icon={Clock} />
            </div>

            {respondidas.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.04]">
                    <div className="bg-brand-lima" style={{ width: `${(conta('promotor') / respondidas.length) * 100}%` }} />
                    <div className="bg-yellow-400" style={{ width: `${(conta('neutro') / respondidas.length) * 100}%` }} />
                    <div className="bg-brand-rosa" style={{ width: `${(conta('detrator') / respondidas.length) * 100}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-brand-lavanda/60">
                    <span><span className="text-brand-lima font-semibold">{conta('promotor')}</span> promotores (9–10)</span>
                    <span><span className="text-yellow-400 font-semibold">{conta('neutro')}</span> neutros (7–8)</span>
                    <span><span className="text-brand-rosa font-semibold">{conta('detrator')}</span> detratores (0–6)</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {depoimentos.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-brand-lavanda">Depoimentos para usar no site e nas propostas</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {depoimentos.map((a) => (
                    <Card key={a.id} className={cn(a.destaque && 'border-brand-lima/40')}>
                      <CardContent className="p-5">
                        <p className="text-sm text-brand-lavanda/90 whitespace-pre-wrap">&ldquo;{a.depoimento}&rdquo;</p>
                        <p className="mt-3 text-xs text-brand-lavanda/50">
                          — {[a.nome_exibicao, a.cargo_empresa].filter(Boolean).join(', ') || a.clientes?.nome}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className={cn('text-xs font-semibold', corNota[categoria(a.nota!)])}>Nota {a.nota}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => alternarDestaque(a)} className={cn(a.destaque && 'text-brand-lima')}>
                              <Star className={cn('h-3.5 w-3.5', a.destaque && 'fill-current')} /> {a.destaque ? 'Destaque' : 'Destacar'}
                            </Button>
                            <CopiarDepoimento a={a} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Card>
              <CardHeader><CardTitle className="text-base">Respostas</CardTitle></CardHeader>
              <CardContent className="p-0">
                {respondidas.length === 0 ? (
                  <p className="px-6 pb-8 text-sm text-brand-lavanda/40">Nenhuma avaliação respondida ainda.</p>
                ) : (
                  <ul>
                    {respondidas.map((a) => (
                      <li key={a.id} className="flex gap-4 border-t border-white/[0.04] px-6 py-4">
                        <span className={cn('w-8 shrink-0 text-2xl font-bold', corNota[categoria(a.nota!)])}>{a.nota}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-brand-lavanda">
                            <Link href={`/clientes/${a.cliente_id}`} className="font-medium hover:text-brand-lima">{a.clientes?.nome}</Link>
                            {a.projetos && <> · <Link href={`/projetos/${a.projeto_id}`} className="text-brand-lavanda/60 hover:text-brand-lima">{a.projetos.nome}</Link></>}
                          </p>
                          {a.comentario && <p className="mt-1 text-sm text-brand-lavanda/70 whitespace-pre-wrap">{a.comentario}</p>}
                          {a.depoimento && !a.autoriza_publicar && (
                            <p className="mt-1 text-xs text-brand-lavanda/40">Deixou depoimento, mas não autorizou publicar.</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-start gap-1">
                          <span className="pt-2 text-xs text-brand-lavanda/40">{formatDate(a.respondida_em)}</span>
                          <BotaoExcluir a={a} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {pendentes.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Aguardando resposta</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <ul>
                    {pendentes.map((a) => (
                      <li key={a.id} className="flex flex-col gap-3 border-t border-white/[0.04] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-brand-lavanda">{a.clientes?.nome}{a.projetos && <span className="text-brand-lavanda/50"> · {a.projetos.nome}</span>}</p>
                          <p className="text-xs text-brand-lavanda/40">Pedida em {formatDate(a.solicitada_em)} <Badge variant="pendente" className="ml-1">Pendente</Badge></p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <PortalLinkAcoes cliente={a.clientes} mensagem="Seu projeto foi concluído! Pode avaliar nosso trabalho? Leva 1 minuto:" />
                          <BotaoExcluir a={a} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

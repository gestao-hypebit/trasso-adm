'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Send, FileCheck, Edit, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type PropostaItem = { id: string; descricao: string; quantidade: number; valor_unitario: number; valor_total: number; ordem: number }
type Proposta = {
  id: string; numero: string; titulo: string; descricao: string | null; status: string
  validade: string | null; condicoes_pagamento: string | null; observacoes: string | null
  created_at: string; enviada_em: string | null; desconto_percentual: number
  valor_total: number; valor_final: number
  clientes: { nome: string; empresa: string | null; email: string | null } | null
  responsavel: { nome: string } | null
  proposta_itens: PropostaItem[]
}

const statusConfig = {
  rascunho:      { label: 'Rascunho',     variant: 'outline' as const },
  enviada:       { label: 'Enviada',       variant: 'default' as const },
  em_negociacao: { label: 'Em Negociação', variant: 'pendente' as const },
  aprovada:      { label: 'Aprovada',      variant: 'aprovada' as const },
  recusada:      { label: 'Recusada',      variant: 'recusada' as const },
  expirada:      { label: 'Expirada',      variant: 'inativo' as const },
}

export default function PropostaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data } = await supabase
        .from('propostas')
        .select('*, clientes(nome, empresa, email), responsavel:profiles!propostas_responsavel_id_fkey(nome), proposta_itens(*)')
        .eq('id', id)
        .single()
      setProposta(data as unknown as Proposta)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="p-6 text-brand-lavanda/40 text-sm">Carregando...</div>
  if (!proposta) return (
    <div className="p-6">
      <Link href="/propostas"><Button variant="outline" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button></Link>
      <p className="mt-6 text-brand-lavanda/50">Proposta não encontrada.</p>
    </div>
  )

  const sc = statusConfig[proposta.status as keyof typeof statusConfig]
  const itens = (proposta.proposta_itens ?? []).sort((a, b) => a.ordem - b.ordem)
  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)
  const desconto = subtotal * (proposta.desconto_percentual / 100)
  const total = subtotal - desconto

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={proposta.numero} description={proposta.titulo} />

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/propostas">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-brand-lavanda/50">{proposta.numero}</span>
                {sc && <Badge variant={sc.variant}>{sc.label}</Badge>}
              </div>
              <h1 className="text-xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {proposta.titulo}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              PDF
            </Button>
            {proposta.status === 'rascunho' && (
              <Button variant="violeta" size="sm">
                <Send className="h-4 w-4" />
                Enviar Proposta
              </Button>
            )}
            {proposta.status === 'aprovada' && (
              <Button size="sm">
                <FileCheck className="h-4 w-4" />
                Converter em Contrato
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-white/[0.1] overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-brand-violeta to-brand-lima" />
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-8 w-8 rounded-lg bg-white/[0.07] border border-white/[0.1] flex items-center justify-center text-brand-lima font-bold text-sm">T</div>
                      <span className="font-bold text-brand-lavanda">trasso</span>
                    </div>
                    <p className="text-xs text-brand-lavanda/40">Criatividade e tecnologia no mesmo traço</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-brand-lavanda/50">{proposta.numero}</p>
                    <p className="text-xs text-brand-lavanda/40">Criada em {formatDate(proposta.created_at)}</p>
                    {proposta.validade && <p className="text-xs text-brand-lavanda/40">Válida até {formatDate(proposta.validade)}</p>}
                  </div>
                </div>

                {proposta.clientes && (
                  <div className="mb-6">
                    <p className="text-xs text-brand-lavanda/40 uppercase tracking-wider mb-1">Para</p>
                    <p className="font-semibold text-brand-lavanda">{proposta.clientes.nome}</p>
                    {proposta.clientes.empresa && <p className="text-sm text-brand-lavanda/60">{proposta.clientes.empresa}</p>}
                    {proposta.clientes.email && <p className="text-xs text-brand-lavanda/40">{proposta.clientes.email}</p>}
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-lg font-bold text-brand-lavanda mb-1" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {proposta.titulo}
                  </h2>
                  {proposta.descricao && <p className="text-sm text-brand-lavanda/60 leading-relaxed">{proposta.descricao}</p>}
                </div>

                {itens.length > 0 && (
                  <div className="mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left text-xs text-brand-lavanda/40 font-medium py-2">Serviço / Entregável</th>
                          <th className="text-center text-xs text-brand-lavanda/40 font-medium py-2 w-16">Qtd</th>
                          <th className="text-right text-xs text-brand-lavanda/40 font-medium py-2 w-28">Valor Unit.</th>
                          <th className="text-right text-xs text-brand-lavanda/40 font-medium py-2 w-28">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((item) => (
                          <tr key={item.id} className="border-b border-white/[0.04]">
                            <td className="py-2.5 text-brand-lavanda">{item.descricao}</td>
                            <td className="py-2.5 text-center text-brand-lavanda/60">{item.quantidade}</td>
                            <td className="py-2.5 text-right text-brand-lavanda/60">{formatCurrency(item.valor_unitario)}</td>
                            <td className="py-2.5 text-right font-medium text-brand-lavanda">{formatCurrency(item.quantidade * item.valor_unitario)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-brand-lavanda/60">Subtotal</span>
                      <span className="text-brand-lavanda">{formatCurrency(subtotal)}</span>
                    </div>
                    {proposta.desconto_percentual > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-lavanda/60">Desconto ({proposta.desconto_percentual}%)</span>
                        <span className="text-brand-rosa">−{formatCurrency(desconto)}</span>
                      </div>
                    )}
                    <Separator className="bg-brand-violeta/20" />
                    <div className="flex justify-between">
                      <span className="font-bold text-brand-lavanda">Total</span>
                      <span className="font-bold text-brand-lima text-lg">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                {proposta.condicoes_pagamento && (
                  <div className="mt-6 p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <p className="text-xs text-brand-lavanda/50 mb-1">Condições de Pagamento</p>
                    <p className="text-sm text-brand-lavanda/80">{proposta.condicoes_pagamento}</p>
                  </div>
                )}

                {proposta.observacoes && (
                  <div className="mt-4">
                    <p className="text-xs text-brand-lavanda/50 mb-1">Observações</p>
                    <p className="text-sm text-brand-lavanda/60">{proposta.observacoes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { label: 'Cliente', value: proposta.clientes?.nome ?? '—' },
                  { label: 'Responsável', value: proposta.responsavel?.nome ?? '—' },
                  { label: 'Criada em', value: formatDate(proposta.created_at) },
                  { label: 'Enviada em', value: proposta.enviada_em ? formatDate(proposta.enviada_em) : '—' },
                  { label: 'Válida até', value: proposta.validade ? formatDate(proposta.validade) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-brand-lavanda/50 text-xs">{label}</span>
                    <span className="text-brand-lavanda text-xs font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Valor da Proposta</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-brand-lima" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {formatCurrency(total)}
                </p>
                <p className="text-xs text-brand-lavanda/40 mt-1">{itens.length} itens</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Baixar PDF
                </Button>
                <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                  <Send className="h-3.5 w-3.5 mr-2" />
                  Enviar por Email
                </Button>
                {proposta.status === 'aprovada' && (
                  <Button className="w-full justify-start text-sm" size="sm">
                    <FileCheck className="h-3.5 w-3.5 mr-2" />
                    Gerar Contrato
                  </Button>
                )}
                <Button variant="destructive" className="w-full justify-start text-sm" size="sm">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Excluir Proposta
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Upload, Edit, FileSignature, ExternalLink } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Contrato = {
  id: string; numero: string; titulo: string; tipo: string | null; status: string
  valor_total: number; data_inicio: string | null; data_fim: string | null
  assinado_em: string | null; condicoes_pagamento: string | null; clausulas: string | null; arquivo_url: string | null
  clientes: { nome: string; empresa: string | null; email: string | null } | null
  responsavel: { nome: string } | null
  propostas: { numero: string } | null
}

const statusConfig = {
  rascunho: { label: 'Rascunho',  variant: 'outline' as const },
  enviado:  { label: 'Enviado',   variant: 'default' as const },
  assinado: { label: 'Assinado',  variant: 'aprovada' as const },
  encerrado:{ label: 'Encerrado', variant: 'inativo' as const },
  cancelado:{ label: 'Cancelado', variant: 'recusada' as const },
}

export default function ContratoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data } = await supabase
        .from('contratos')
        .select('*, clientes(nome, empresa, email), responsavel:profiles!contratos_responsavel_id_fkey(nome), propostas(numero)')
        .eq('id', id)
        .single()
      setContrato(data as unknown as Contrato)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="p-6 text-brand-lavanda/40 text-sm">Carregando...</div>
  if (!contrato) return (
    <div className="p-6">
      <Link href="/contratos"><Button variant="outline" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button></Link>
      <p className="mt-6 text-brand-lavanda/50">Contrato não encontrado.</p>
    </div>
  )

  const sc = statusConfig[contrato.status as keyof typeof statusConfig]

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={contrato.numero} description={contrato.titulo} />

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/contratos">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-brand-lavanda/50">{contrato.numero}</span>
                {sc && <Badge variant={sc.variant}>{sc.label}</Badge>}
              </div>
              <h1 className="text-xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {contrato.titulo}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> PDF</Button>
            <Button variant="outline" size="sm"><Upload className="h-4 w-4" /> Enviar Assinado</Button>
            <Button variant="outline" size="sm"><Edit className="h-4 w-4" /> Editar</Button>
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
                    <p className="font-mono text-xs text-brand-lavanda/50">{contrato.numero}</p>
                    <p className="text-xs text-brand-lavanda/40">
                      Vigência: {contrato.data_inicio ? formatDate(contrato.data_inicio) : '—'} → {contrato.data_fim ? formatDate(contrato.data_fim) : 'Indefinido'}
                    </p>
                    {contrato.assinado_em && <p className="text-xs text-brand-lima mt-0.5">Assinado em {formatDate(contrato.assinado_em)}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  {contrato.clientes && (
                    <div>
                      <p className="text-xs text-brand-lavanda/40 uppercase tracking-wider mb-1">Contratante</p>
                      <p className="font-semibold text-brand-lavanda">{contrato.clientes.nome}</p>
                      {contrato.clientes.empresa && <p className="text-sm text-brand-lavanda/60">{contrato.clientes.empresa}</p>}
                      {contrato.clientes.email && <p className="text-xs text-brand-lavanda/40">{contrato.clientes.email}</p>}
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-brand-lavanda/40 uppercase tracking-wider mb-1">Contratada</p>
                    <p className="font-semibold text-brand-lavanda">Trasso Agência Criativa</p>
                    <p className="text-sm text-brand-lavanda/60">CNPJ: 00.000.000/0001-00</p>
                    <p className="text-xs text-brand-lavanda/40">contato@trasso.com.br</p>
                  </div>
                </div>

                {contrato.condicoes_pagamento && (
                  <div className="mb-6 p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <p className="text-xs text-brand-lavanda/50 mb-1">Condições de Pagamento</p>
                    <p className="text-sm text-brand-lavanda/80">{contrato.condicoes_pagamento}</p>
                    <p className="text-lg font-bold text-brand-lima mt-2">{formatCurrency(contrato.valor_total)}</p>
                  </div>
                )}

                {contrato.clausulas && (
                  <div>
                    <p className="text-xs text-brand-lavanda/40 uppercase tracking-wider mb-3">Cláusulas Contratuais</p>
                    <div className="whitespace-pre-wrap text-sm text-brand-lavanda/70 leading-relaxed font-mono text-xs bg-white/[0.02] rounded-xl p-4">
                      {contrato.clausulas}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { label: 'Cliente', value: contrato.clientes?.nome ?? '—' },
                  { label: 'Responsável', value: contrato.responsavel?.nome ?? '—' },
                  { label: 'Tipo', value: contrato.tipo ?? '—' },
                  { label: 'Proposta origem', value: contrato.propostas?.numero ?? '—' },
                  { label: 'Início', value: contrato.data_inicio ? formatDate(contrato.data_inicio) : '—' },
                  { label: 'Término', value: contrato.data_fim ? formatDate(contrato.data_fim) : 'Indeterminado' },
                  { label: 'Assinado em', value: contrato.assinado_em ? formatDate(contrato.assinado_em) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-brand-lavanda/50 text-xs">{label}</span>
                    <span className="text-brand-lavanda text-xs font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Valor do Contrato</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {formatCurrency(contrato.valor_total)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Documento Assinado</CardTitle></CardHeader>
              <CardContent>
                {contrato.arquivo_url ? (
                  <Button variant="outline" className="w-full" size="sm" asChild>
                    <a href={contrato.arquivo_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Abrir PDF
                    </a>
                  </Button>
                ) : (
                  <div className="text-center py-4">
                    <FileSignature className="h-8 w-8 text-brand-lavanda/20 mx-auto mb-2" />
                    <p className="text-xs text-brand-lavanda/40 mb-3">Nenhum arquivo enviado</p>
                    <Button variant="outline" size="sm" className="w-full">
                      <Upload className="h-4 w-4" />
                      Enviar PDF assinado
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

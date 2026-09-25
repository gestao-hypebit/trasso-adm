'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, Download, Upload, Edit, FileSignature, ExternalLink, Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ContratoPDF, type AgenciaPDFData } from '@/components/contratos/contrato-pdf'
import { ContratoFormDialog } from '@/components/contratos/contrato-form-dialog'
import { enviarContratoAssinado, urlArquivoContrato } from '@/lib/contratos/arquivo'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(m => m.PDFDownloadLink),
  { ssr: false, loading: () => <Button variant="outline" size="sm" disabled><Loader2 className="h-4 w-4 animate-spin" />PDF</Button> }
)

type Contrato = {
  id: string; numero: string; titulo: string; tipo: string | null; status: string; cliente_id: string | null
  assinado_nome: string | null; assinado_ip: string | null
  valor_total: number; data_inicio: string | null; data_fim: string | null
  assinado_em: string | null; condicoes_pagamento: string | null; clausulas: string | null; arquivo_url: string | null
  clientes: { nome: string; empresa: string | null; email: string | null; cpf_cnpj: string | null } | null
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
  const [agencia, setAgencia] = useState<AgenciaPDFData>({ nome: 'Trasso', cnpj: null, email: null, telefone: null, endereco: null, cidade: null, logo_url: null })
  const [editarOpen, setEditarOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data }, { data: cfg }] = await Promise.all([
      supabase
        .from('contratos')
        .select('*, clientes(nome, empresa, email, cpf_cnpj), responsavel:profiles!contratos_responsavel_id_fkey(nome), propostas(numero)')
        .eq('id', id)
        .single(),
      (supabase as any).from('configuracoes_agencia').select('nome, cnpj, email, telefone, endereco, cidade, logo_url').limit(1).maybeSingle(),
    ])
    setContrato(data as unknown as Contrato)
    if (cfg) setAgencia({ ...cfg, nome: cfg.nome || 'Trasso' })
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleStatusChange(status: string) {
    await (createClient() as any).from('contratos').update({ status }).eq('id', id)
    setContrato(prev => prev ? { ...prev, status } : prev)
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setEnviando(true)
    setErroArquivo(null)
    try {
      const path = await enviarContratoAssinado(createClient(), id, file)
      setContrato(prev => prev ? { ...prev, arquivo_url: path } : prev)
    } catch (err) {
      setErroArquivo((err as { message?: string })?.message ?? 'Falha no envio.')
    }
    setEnviando(false)
  }

  async function handleAbrirArquivo() {
    if (!contrato?.arquivo_url) return
    setAbrindo(true)
    const url = await urlArquivoContrato(createClient(), contrato.arquivo_url)
    setAbrindo(false)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else setErroArquivo('Não foi possível abrir o arquivo.')
  }

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
            <PDFDownloadLink document={<ContratoPDF contrato={contrato} agencia={agencia} />} fileName={`${contrato.numero}.pdf`}>
              {({ loading: pdfLoading }) => (
                <Button variant="outline" size="sm" disabled={pdfLoading}>
                  {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
                </Button>
              )}
            </PDFDownloadLink>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar Assinado
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditarOpen(true)}><Edit className="h-4 w-4" /> Editar</Button>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleArquivo} />
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
                    <p className="font-semibold text-brand-lavanda">{agencia.nome}</p>
                    {agencia.cnpj && <p className="text-sm text-brand-lavanda/60">CNPJ: {agencia.cnpj}</p>}
                    {agencia.email && <p className="text-xs text-brand-lavanda/40">{agencia.email}</p>}
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
              <CardHeader className="pb-3"><CardTitle className="text-sm">Status</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Select key={contrato.status} defaultValue={contrato.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contrato.status === 'rascunho' && (
                  <p className="text-[11px] text-brand-lavanda/40">Mude para &quot;Enviado&quot; para o cliente poder assinar pelo portal.</p>
                )}
              </CardContent>
            </Card>

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
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full" size="sm" onClick={handleAbrirArquivo} disabled={abrindo}>
                      {abrindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      Abrir PDF
                    </Button>
                    <Button variant="ghost" className="w-full text-xs" size="sm" onClick={() => fileRef.current?.click()} disabled={enviando}>
                      Substituir arquivo
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <FileSignature className="h-8 w-8 text-brand-lavanda/20 mx-auto mb-2" />
                    <p className="text-xs text-brand-lavanda/40 mb-3">Nenhum arquivo enviado</p>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => fileRef.current?.click()} disabled={enviando}>
                      {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Enviar PDF assinado
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        {erroArquivo && <p className="mt-3 text-xs text-brand-rosa">{erroArquivo}</p>}
      </main>
      <ContratoFormDialog
        contrato={{
          id: contrato.id, cliente_id: contrato.cliente_id, titulo: contrato.titulo, tipo: contrato.tipo, status: contrato.status,
          valor_total: contrato.valor_total, data_inicio: contrato.data_inicio, data_fim: contrato.data_fim,
          condicoes_pagamento: contrato.condicoes_pagamento, clausulas: contrato.clausulas,
        }}
        open={editarOpen}
        onOpenChange={setEditarOpen}
        onSaved={() => load()}
      />
    </div>
  )
}

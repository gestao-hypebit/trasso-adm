'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, Wallet, RefreshCw, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { IndicadorForm, type IndicadorExistente } from '@/components/financeiro/indicador-form'
import { IndicacaoForm } from '@/components/financeiro/indicacao-form'
import { IndicadorExtratoDialog } from '@/components/financeiro/indicador-extrato-dialog'
import type { ExtratoComissaoRow } from '@/components/financeiro/extrato-comissao-pdf'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  gerarComissoesAction,
  marcarComissaoPagaAction,
  cancelarComissaoAction,
  encerrarIndicacaoAction,
  excluirIndicacaoAction,
  excluirIndicadorAction,
} from './actions'

type ComissaoRow = {
  id: string
  competencia: string
  valor: number
  indicador_id: string
  indicadores: { nome: string } | null
  indicacoes: { clientes: { nome: string } | null } | null
  lancamentos: { status: string } | null
}

type IndicadorRow = IndicadorExistente & { clientes: { nome: string } | null }

type IndicacaoRow = {
  id: string
  tipo_comissao: string
  valor_fixo: number | null
  percentual: number | null
  status: string
  data_inicio: string
  indicadores: { nome: string } | null
  clientes: { nome: string } | null
}

const statusConfig: Record<string, { label: string; variant: 'concluido' | 'pendente' | 'inativo' }> = {
  pago: { label: 'Pago', variant: 'concluido' },
  pendente: { label: 'Pendente', variant: 'pendente' },
  cancelado: { label: 'Cancelado', variant: 'inativo' },
}

const indicacaoStatusConfig: Record<string, { label: string; variant: 'ativo' | 'pendente' | 'inativo' }> = {
  ativa: { label: 'Ativa', variant: 'ativo' },
  pausada: { label: 'Pausada', variant: 'pendente' },
  encerrada: { label: 'Encerrada', variant: 'inativo' },
}

export default function ComissoesPage() {
  const pathname = usePathname()
  const [comissoes, setComissoes] = useState<ComissaoRow[]>([])
  const [indicadores, setIndicadores] = useState<IndicadorRow[]>([])
  const [indicacoes, setIndicacoes] = useState<IndicacaoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [isGenerating, startGenerating] = useTransition()
  const [deletingIndicadorId, setDeletingIndicadorId] = useState<string | null>(null)
  const [deletingIndicacaoId, setDeletingIndicacaoId] = useState<string | null>(null)
  const [agencia, setAgencia] = useState<{ logoUrl: string | null; nome: string }>({ logoUrl: null, nome: 'Trasso' })

  const load = useCallback(async () => {
    const supabase = createClient()
    const [c, i, ind, ag] = await Promise.all([
      supabase
        .from('comissoes')
        .select('id, competencia, valor, indicador_id, indicadores(nome), indicacoes(clientes(nome)), lancamentos(status)')
        .order('competencia', { ascending: false }),
      supabase.from('indicadores').select('id, tipo, cliente_id, nome, email, telefone, whatsapp, chave_pix, observacoes, ativo, clientes(nome)').order('nome'),
      supabase.from('indicacoes').select('id, tipo_comissao, valor_fixo, percentual, status, data_inicio, indicadores(nome), clientes:cliente_indicado_id(nome)').order('data_inicio', { ascending: false }),
      (supabase as any).from('configuracoes_agencia').select('logo_url, nome').maybeSingle(),
    ])
    setComissoes((c.data as any) ?? [])
    setIndicadores((i.data as any) ?? [])
    setIndicacoes((ind.data as any) ?? [])
    if (ag.data) setAgencia({ logoUrl: ag.data.logo_url, nome: ag.data.nome || 'Trasso' })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  function handleGerar() {
    startGenerating(async () => {
      const competencia = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const result = await gerarComissoesAction(competencia)
      if (!result.success) {
        setToast({ msg: result.error, ok: false })
        return
      }
      const { geradas, ignoradas, erros } = result.result
      setToast({
        msg: `${geradas} comissão${geradas !== 1 ? 'ões' : ''} gerada${geradas !== 1 ? 's' : ''}, ${ignoradas} ignorada${ignoradas !== 1 ? 's' : ''}${erros.length ? `, ${erros.length} com erro` : ''}.`,
        ok: erros.length === 0,
      })
      load()
    })
  }

  async function handleMarcarPaga(id: string) {
    const result = await marcarComissaoPagaAction(id)
    if (!result.success) { setToast({ msg: result.error, ok: false }); return }
    load()
  }

  async function handleCancelar(id: string) {
    const result = await cancelarComissaoAction(id)
    if (!result.success) { setToast({ msg: result.error, ok: false }); return }
    load()
  }

  async function handleEncerrarIndicacao(id: string) {
    const result = await encerrarIndicacaoAction(id)
    if (!result.success) { setToast({ msg: result.error, ok: false }); return }
    load()
  }

  async function handleExcluirIndicacao(id: string) {
    const result = await excluirIndicacaoAction(id)
    setDeletingIndicacaoId(null)
    if (!result.success) { setToast({ msg: result.error, ok: false }); return }
    load()
  }

  async function handleExcluirIndicador(id: string) {
    const result = await excluirIndicadorAction(id)
    setDeletingIndicadorId(null)
    if (!result.success) { setToast({ msg: result.error, ok: false }); return }
    load()
  }

  const comissoesFiltradas = comissoes.filter((c) => {
    const status = c.lancamentos?.status ?? 'pendente'
    return filtroStatus === 'todos' || status === filtroStatus
  })

  const totalPendente = comissoes.filter((c) => (c.lancamentos?.status ?? 'pendente') === 'pendente').reduce((s, c) => s + c.valor, 0)
  const totalPago = comissoes.filter((c) => c.lancamentos?.status === 'pago').reduce((s, c) => s + c.valor, 0)

  function extratoRowsFor(indicadorId: string): ExtratoComissaoRow[] {
    return comissoes
      .filter((c) => c.indicador_id === indicadorId)
      .map((c) => ({
        id: c.id,
        competencia: c.competencia,
        valor: c.valor,
        status: c.lancamentos?.status ?? 'pendente',
        clienteIndicadoNome: c.indicacoes?.clientes?.nome ?? '—',
      }))
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description="Comissões por indicação" />

      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm shadow-xl border transition-all',
          toast.ok ? 'bg-brand-lima/10 border-brand-lima/30 text-brand-lima' : 'bg-brand-rosa/10 border-brand-rosa/30 text-brand-rosa'
        )}>
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <main className="flex-1 p-6">
        <PageHeader title="Financeiro" description="Comissões">
          <Button onClick={handleGerar} disabled={isGenerating}>
            <RefreshCw className={cn('h-4 w-4', isGenerating && 'animate-spin')} />
            {isGenerating ? 'Gerando...' : 'Gerar comissões do mês'}
          </Button>
        </PageHeader>
        <FinanceiroSubNav pathname={pathname} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{formatCurrency(totalPendente)}</p>
                <p className="text-xs text-brand-lavanda/50">A pagar (pendente)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-lima/10">
                <Wallet className="h-5 w-5 text-brand-lima" />
              </div>
              <div>
                <p className="text-lg font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{formatCurrency(totalPago)}</p>
                <p className="text-xs text-brand-lavanda/50">Pago no total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="historico">
          <TabsList>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
            <TabsTrigger value="indicacoes">Indicações</TabsTrigger>
          </TabsList>

          <TabsContent value="historico">
            <div className="flex justify-end mb-4">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Competência</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Indicador</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Cliente indicado</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Valor</th>
                        <th className="text-center text-xs text-brand-lavanda/50 font-medium px-4 py-3">Status</th>
                        <th className="w-32" />
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                      ) : comissoesFiltradas.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Nenhuma comissão gerada ainda.</td></tr>
                      ) : comissoesFiltradas.map((c) => {
                        const status = c.lancamentos?.status ?? 'pendente'
                        const sc = statusConfig[status]
                        return (
                          <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-3.5 text-brand-lavanda font-medium capitalize">{format(new Date(c.competencia + 'T12:00:00Z'), 'MMMM yyyy', { locale: ptBR })}</td>
                            <td className="px-4 py-3.5 text-brand-lavanda/80">{c.indicadores?.nome ?? '—'}</td>
                            <td className="px-4 py-3.5 text-brand-lavanda/60">{c.indicacoes?.clientes?.nome ?? '—'}</td>
                            <td className="px-4 py-3.5 text-right font-semibold text-brand-rosa whitespace-nowrap">{formatCurrency(c.valor)}</td>
                            <td className="px-4 py-3.5 text-center">{sc && <Badge variant={sc.variant}>{sc.label}</Badge>}</td>
                            <td className="px-2 py-3.5 text-right whitespace-nowrap">
                              {status === 'pendente' && (
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => handleMarcarPaga(c.id)} className="text-xs text-brand-lima hover:text-brand-lima/80 font-medium transition-colors">Marcar paga</button>
                                  <span className="text-brand-lavanda/20">·</span>
                                  <button onClick={() => handleCancelar(c.id)} className="text-xs text-brand-lavanda/40 hover:text-brand-rosa transition-colors">Cancelar</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indicadores">
            <div className="flex justify-end mb-4">
              <IndicadorForm onSuccess={load} />
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Nome</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Tipo</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Contato</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">PIX</th>
                        <th className="text-center text-xs text-brand-lavanda/50 font-medium px-4 py-3">Status</th>
                        <th className="w-28" />
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                      ) : indicadores.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Nenhum indicador cadastrado.</td></tr>
                      ) : indicadores.map((i) => (
                        <tr key={i.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 py-3.5 text-brand-lavanda font-medium">{i.nome}</td>
                          <td className="px-4 py-3.5 text-brand-lavanda/60">{i.tipo === 'cliente' ? `Cliente (${i.clientes?.nome ?? '—'})` : 'Parceiro externo'}</td>
                          <td className="px-4 py-3.5 text-brand-lavanda/60 text-xs">{i.email || i.telefone || '—'}</td>
                          <td className="px-4 py-3.5 text-brand-lavanda/60 text-xs">{i.chave_pix || '—'}</td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge variant={i.ativo ? 'ativo' : 'inativo'}>{i.ativo ? 'Ativo' : 'Inativo'}</Badge>
                          </td>
                          <td className="px-2 py-3.5 text-center">
                            {deletingIndicadorId === i.id ? (
                              <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                <button onClick={() => handleExcluirIndicador(i.id)} className="text-xs text-brand-rosa hover:text-brand-rosa/80 font-medium transition-colors">Excluir</button>
                                <span className="text-brand-lavanda/20">·</span>
                                <button onClick={() => setDeletingIndicadorId(null)} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 transition-colors">Cancelar</button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <IndicadorExtratoDialog
                                  indicador={{ id: i.id, nome: i.nome, tipo: i.tipo, email: i.email, telefone: i.telefone, whatsapp: i.whatsapp, chavePix: i.chave_pix }}
                                  comissoes={extratoRowsFor(i.id)}
                                  logoUrl={agencia.logoUrl}
                                  agenciaNome={agencia.nome}
                                />
                                <IndicadorForm indicador={i} onSuccess={load} />
                                <button
                                  onClick={() => setDeletingIndicadorId(i.id)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-brand-lavanda/0 group-hover:text-brand-lavanda/25 hover:!text-brand-rosa hover:bg-brand-rosa/10 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indicacoes">
            <div className="flex justify-end mb-4">
              <IndicacaoForm onSuccess={load} />
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Indicador</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Cliente indicado</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Comissão</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Início</th>
                        <th className="text-center text-xs text-brand-lavanda/50 font-medium px-4 py-3">Status</th>
                        <th className="w-36" />
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                      ) : indicacoes.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Nenhuma indicação cadastrada.</td></tr>
                      ) : indicacoes.map((i) => {
                        const sc = indicacaoStatusConfig[i.status]
                        return (
                          <tr key={i.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-3.5 text-brand-lavanda font-medium">{i.indicadores?.nome ?? '—'}</td>
                            <td className="px-4 py-3.5 text-brand-lavanda/60">{i.clientes?.nome ?? '—'}</td>
                            <td className="px-4 py-3.5 text-brand-lavanda/60">
                              {i.tipo_comissao === 'fixo' ? formatCurrency(i.valor_fixo ?? 0) + '/mês' : `${i.percentual}%`}
                            </td>
                            <td className="px-4 py-3.5 text-brand-lavanda/60 text-xs">{formatDate(i.data_inicio)}</td>
                            <td className="px-4 py-3.5 text-center">{sc && <Badge variant={sc.variant}>{sc.label}</Badge>}</td>
                            <td className="px-2 py-3.5 text-right whitespace-nowrap">
                              {deletingIndicacaoId === i.id ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={() => handleExcluirIndicacao(i.id)} className="text-xs text-brand-rosa hover:text-brand-rosa/80 font-medium transition-colors">Excluir</button>
                                  <span className="text-brand-lavanda/20">·</span>
                                  <button onClick={() => setDeletingIndicacaoId(null)} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 transition-colors">Cancelar</button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  {i.status === 'ativa' && (
                                    <>
                                      <button onClick={() => handleEncerrarIndicacao(i.id)} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70 transition-colors">Encerrar</button>
                                      <span className="text-brand-lavanda/20">·</span>
                                    </>
                                  )}
                                  <button onClick={() => setDeletingIndicacaoId(i.id)} className="text-xs text-brand-lavanda/40 hover:text-brand-rosa transition-colors">Excluir</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

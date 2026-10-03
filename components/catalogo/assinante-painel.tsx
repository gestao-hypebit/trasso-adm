'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Copy, Check, MessageCircle, Loader2, Link2, FileText, UserRound } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, formatDate, whatsappUrl } from '@/lib/utils'
import {
  cicloLabel, formaLabel, assinaturaStatus, cobrancaStatus,
  type AssinaturaAsaas, type CobrancaAsaas,
} from '@/lib/asaas/rotulos'

export type Assinante = {
  chave: string
  clienteId: string | null
  nome: string
  empresa: string | null
  whatsapp: string | null
  mensalidade: number
  desde: string | null
  mesesPagos: number
  pagoEsteMes: boolean
  ativo: boolean
  atraso: number
  diasAtraso: number
  status: string | null
  asaasCustomerId: string | null
  assinaturas: AssinaturaAsaas[]
  // Lançamentos do financeiro (usado quando o cliente não está no Asaas).
  historico: { data: string; valor: number; status: string; descricao: string }[]
  // Assinatura do Asaas sem cliente do sistema ligado a ela.
  soNoAsaas: boolean
}

type Opcao = { id: string; nome: string }

const statusLancamento: Record<string, { label: string; variant: 'aprovada' | 'pendente' | 'inativo' }> = {
  recebido: { label: 'Recebido', variant: 'aprovada' },
  pendente: { label: 'Pendente', variant: 'pendente' },
  cancelado: { label: 'Cancelado', variant: 'inativo' },
}

export function AssinantePainel({
  assinante, onClose, asaasConfigurado, clientesSemAsaas, customersSemCliente, onVinculado,
}: {
  assinante: Assinante | null
  onClose: () => void
  asaasConfigurado: boolean
  clientesSemAsaas: Opcao[]
  customersSemCliente: Opcao[]
  onVinculado: () => void
}) {
  const [cobrancas, setCobrancas] = useState<CobrancaAsaas[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [vinculo, setVinculo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroVinculo, setErroVinculo] = useState<string | null>(null)

  const customerId = assinante?.asaasCustomerId ?? null

  useEffect(() => {
    setCobrancas(null)
    setErro(null)
    setErroVinculo(null)
    setVinculo('')
    if (!customerId || !asaasConfigurado) return
    let cancelado = false
    fetch(`/api/asaas/clientes/${encodeURIComponent(customerId)}/cobrancas`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(json.error ?? `Erro ${r.status}`)
        return json.cobrancas as CobrancaAsaas[]
      })
      .then((c) => { if (!cancelado) setCobrancas(c) })
      .catch((e) => { if (!cancelado) setErro(e.message) })
    return () => { cancelado = true }
  }, [customerId, asaasConfigurado])

  async function copiar(id: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(id)
      setTimeout(() => setCopiado((v) => (v === id ? null : v)), 1500)
    } catch {}
  }

  // Liga o cliente do sistema ao cliente do Asaas (nos dois sentidos da tela).
  async function vincular() {
    if (!assinante || !vinculo) return
    setSalvando(true)
    setErroVinculo(null)
    const clienteId = assinante.soNoAsaas ? vinculo : assinante.clienteId
    const asaasId = assinante.soNoAsaas ? assinante.asaasCustomerId : vinculo
    const { error } = await (createClient() as any).from('clientes').update({ asaas_customer_id: asaasId }).eq('id', clienteId)
    setSalvando(false)
    if (error) {
      setErroVinculo(error.code === '23505' ? 'Esse cliente do Asaas já está ligado a outro cliente.' : error.message)
      return
    }
    onVinculado()
    onClose()
  }

  if (!assinante) return <Sheet open={false} />

  const a = assinante
  const primeiroNome = a.nome.split(' ')[0]
  const abertas = (cobrancas ?? []).filter((c) => cobrancaStatus(c.status).aberta)
  const pagas = (cobrancas ?? []).filter((c) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(c.status))
  const opcoesVinculo = a.soNoAsaas ? clientesSemAsaas : customersSemCliente

  function mensagemFatura(c: CobrancaAsaas) {
    const venc = formatDate(c.vencimento)
    const quando = c.status === 'OVERDUE' ? `que venceu em ${venc}` : `com vencimento em ${venc}`
    return `Oi ${primeiroNome}! Tudo bem? Segue o link da fatura do Catálogo Place de ${formatCurrency(c.valor)}, ${quando}: ${c.faturaUrl}`
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent>
        {/* Cabeçalho */}
        <div className="border-b border-white/[0.06] px-6 py-5 pr-12">
          <SheetTitle className="text-lg font-semibold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {a.nome}
          </SheetTitle>
          <SheetDescription className="text-xs text-brand-lavanda/40">
            {a.empresa ?? (a.soNoAsaas ? 'Cliente só no Asaas' : 'Assinante do Catálogo Place')}
          </SheetDescription>
          <div className="mt-3 flex flex-wrap gap-2">
            {a.clienteId && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/clientes/${a.clienteId}`}><UserRound className="h-3.5 w-3.5" /> Ver cliente</Link>
              </Button>
            )}
            {whatsappUrl(a.whatsapp) && (
              <Button size="sm" variant="outline" asChild>
                <a href={whatsappUrl(a.whatsapp)!} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3">
            <Resumo titulo="Mensalidade" valor={a.mensalidade ? formatCurrency(a.mensalidade) : '—'} />
            <Resumo titulo="Em atraso" valor={a.atraso ? formatCurrency(a.atraso) : '—'} destaque={a.atraso > 0} sub={a.atraso ? `há ${a.diasAtraso} dias` : undefined} />
            <Resumo titulo="Assinante desde" valor={a.desde ? `${a.desde.slice(5, 7)}/${a.desde.slice(0, 4)}` : '—'} />
            <Resumo titulo="Meses pagos" valor={a.mesesPagos ? String(a.mesesPagos) : '—'} />
          </div>

          {/* Assinaturas no Asaas */}
          {a.assinaturas.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-lavanda/50">Assinatura no Asaas</h3>
              <div className="space-y-2">
                {a.assinaturas.map((s) => {
                  const st = assinaturaStatus[s.status] ?? { label: s.status, variant: 'inativo' as const }
                  return (
                    <div key={s.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-brand-lavanda">
                            {formatCurrency(s.valor)} <span className="text-xs font-normal text-brand-lavanda/50">/ {cicloLabel[s.ciclo] ?? s.ciclo}</span>
                          </p>
                          {s.descricao && <p className="mt-0.5 text-xs text-brand-lavanda/50">{s.descricao}</p>}
                        </div>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <Dado rotulo="Próximo vencimento" valor={s.status === 'ACTIVE' ? formatDate(s.proximoVencimento) : '—'} />
                        <Dado rotulo="Forma" valor={formaLabel[s.formaPagamento] ?? s.formaPagamento} />
                        <Dado rotulo="Criada em" valor={formatDate(s.criadaEm)} />
                      </dl>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Faturas do Asaas */}
          {customerId && asaasConfigurado && (
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-brand-lavanda/50">Faturas</h3>
                {cobrancas && cobrancas.length > 0 && (
                  <p className="text-[11px] text-brand-lavanda/40">
                    {pagas.length} paga(s) · {formatCurrency(pagas.reduce((s, c) => s + c.valor, 0))}
                    {abertas.length > 0 && <> · <span className="text-yellow-400">{abertas.length} em aberto</span></>}
                  </p>
                )}
              </div>
              {erro ? (
                <p className="rounded-lg border border-brand-rosa/20 bg-brand-rosa/[0.05] px-3 py-2 text-xs text-brand-rosa">Não deu para buscar as faturas: {erro}</p>
              ) : !cobrancas ? (
                <p className="flex items-center gap-2 py-6 text-xs text-brand-lavanda/40"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando faturas no Asaas...</p>
              ) : cobrancas.length === 0 ? (
                <p className="py-6 text-xs text-brand-lavanda/40">Nenhuma fatura no Asaas.</p>
              ) : (
                <ul className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06]">
                  {cobrancas.map((c) => {
                    const st = cobrancaStatus(c.status)
                    const wa = st.aberta && c.faturaUrl ? whatsappUrl(a.whatsapp, mensagemFatura(c)) : null
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-brand-lavanda">{formatCurrency(c.valor)}</span>
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-brand-lavanda/40">
                            Vence {formatDate(c.vencimento)}
                            {c.pagoEm && ` · paga em ${formatDate(c.pagoEm)}`}
                            {` · ${formaLabel[c.formaPagamento] ?? c.formaPagamento}`}
                            {c.valorLiquido != null && c.valorLiquido !== c.valor && ` · líquido ${formatCurrency(c.valorLiquido)}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {wa && (
                            <IconeAcao href={wa} titulo="Mandar fatura no WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></IconeAcao>
                          )}
                          {c.faturaUrl && (
                            <button
                              type="button"
                              onClick={() => copiar(c.id, c.faturaUrl!)}
                              title="Copiar link da fatura"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-brand-lavanda/40 transition-colors hover:bg-white/[0.06] hover:text-brand-lavanda"
                            >
                              {copiado === c.id ? <Check className="h-3.5 w-3.5 text-brand-lima" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          {c.boletoUrl && (
                            <IconeAcao href={c.boletoUrl} titulo="Abrir boleto"><FileText className="h-3.5 w-3.5" /></IconeAcao>
                          )}
                          {c.faturaUrl && (
                            <IconeAcao href={c.faturaUrl} titulo="Abrir fatura"><ExternalLink className="h-3.5 w-3.5" /></IconeAcao>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          {/* Sem Asaas: histórico do financeiro */}
          {!customerId && a.historico.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-lavanda/50">Lançamentos no financeiro</h3>
              <ul className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06]">
                {a.historico.map((l, i) => {
                  const st = statusLancamento[l.status] ?? { label: l.status, variant: 'inativo' as const }
                  return (
                    <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-brand-lavanda">{l.descricao}</p>
                        <p className="text-[11px] text-brand-lavanda/40">{formatDate(l.data)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-medium text-brand-lavanda">{formatCurrency(l.valor)}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* Vincular */}
          {asaasConfigurado && (!customerId || a.soNoAsaas) && (
            <section className="rounded-xl border border-dashed border-white/[0.1] p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-brand-lavanda">
                <Link2 className="h-4 w-4 text-brand-violeta" />
                {a.soNoAsaas ? 'Ligar a um cliente do sistema' : 'Ligar ao Asaas'}
              </h3>
              <p className="mt-1 text-xs text-brand-lavanda/50">
                {a.soNoAsaas
                  ? 'Esta assinatura existe no Asaas, mas nenhum cliente do sistema está ligado a ela.'
                  : 'Este cliente ainda não está ligado a um cliente do Asaas, por isso as faturas não aparecem.'}
              </p>
              {opcoesVinculo.length === 0 ? (
                <p className="mt-3 text-xs text-brand-lavanda/40">
                  {a.soNoAsaas ? 'Nenhum cliente do Catálogo Place livre para ligar. Cadastre o cliente primeiro.' : 'Nenhuma assinatura do Asaas sem cliente.'}
                </p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <select
                    value={vinculo}
                    onChange={(e) => setVinculo(e.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-md border border-white/[0.1] bg-transparent px-3 text-sm text-brand-lavanda outline-none"
                  >
                    <option value="" className="bg-brand-noite">Escolha...</option>
                    {opcoesVinculo.map((o) => <option key={o.id} value={o.id} className="bg-brand-noite">{o.nome}</option>)}
                  </select>
                  <Button size="sm" onClick={vincular} disabled={!vinculo || salvando}>
                    {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Ligar'}
                  </Button>
                </div>
              )}
              {erroVinculo && <p className="mt-2 text-xs text-brand-rosa">{erroVinculo}</p>}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Resumo({ titulo, valor, sub, destaque }: { titulo: string; valor: string; sub?: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[11px] text-brand-lavanda/40">{titulo}</p>
      <p className={cn('text-base font-semibold', destaque ? 'text-brand-rosa' : 'text-brand-lavanda')} style={{ fontFamily: 'var(--font-space-grotesk)' }}>{valor}</p>
      {sub && <p className="text-[11px] text-brand-rosa/70">{sub}</p>}
    </div>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-brand-lavanda/40">{rotulo}</dt>
      <dd className="mt-0.5 text-brand-lavanda/80">{valor}</dd>
    </div>
  )
}

function IconeAcao({ href, titulo, children }: { href: string; titulo: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={titulo}
      className="flex h-7 w-7 items-center justify-center rounded-md text-brand-lavanda/40 transition-colors hover:bg-white/[0.06] hover:text-brand-lavanda"
    >
      {children}
    </a>
  )
}

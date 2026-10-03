'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, Copy, Check, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, formatDate, toISODateLocal } from '@/lib/utils'

type Status = { chave: boolean; webhookToken: boolean; ambiente: string }
type Resultado = { acao: string; paymentId: string; vencimento: string; valorAsaas: number; status: string; cliente?: string; valorSistema?: number; detalhe?: string }
type Sync = { inicio: string; total: number; resumo: Record<string, number>; resultados: Resultado[]; erros: { paymentId: string; erro: string }[] }
type Pendencia = {
  payment_id: string
  motivo: 'cliente_nao_encontrado' | 'varios_lancamentos' | 'cobranca_excluida'
  detalhes: {
    cobranca?: { value: number; dueDate: string; description: string | null; customer: string }
    cliente_nome?: string
    candidatos?: { id: string; valor: number; descricao: string; data: string; status: string }[]
  }
  created_at: string
}
type Evento = { id: string; evento: string; resultado: string | null; erro: string | null; created_at: string }

const acaoLabel: Record<string, { label: string; variant: 'aprovada' | 'default' | 'pendente' | 'inativo' | 'outline' }> = {
  ligado: { label: 'Liga ao lançamento manual', variant: 'aprovada' },
  criado: { label: 'Cria lançamento', variant: 'default' },
  atualizado: { label: 'Já ligado, atualiza', variant: 'outline' },
  pendencia: { label: 'Precisa da sua decisão', variant: 'pendente' },
  ignorado: { label: 'Ignorado', variant: 'inativo' },
}

const motivoLabel = {
  cliente_nao_encontrado: 'Cliente do Asaas não encontrado pelo CPF/CNPJ nem pelo e-mail',
  varios_lancamentos: 'Há mais de um lançamento desse cliente no mesmo mês',
  cobranca_excluida: 'A cobrança foi excluída no Asaas, mas estava ligada a um lançamento manual (o lançamento continua lá)',
}

async function postJson(url: string, corpo: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
  return json
}

export default function AsaasPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [configId, setConfigId] = useState<string | null>(null)
  const [inicioSalvo, setInicioSalvo] = useState<string | null>(null)
  const [inicio, setInicio] = useState(() => toISODateLocal(new Date()).slice(0, 8) + '01')
  const [sync, setSync] = useState<Sync | null>(null)
  const [simulado, setSimulado] = useState(false)
  const [rodando, setRodando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendencias, setPendencias] = useState<Pendencia[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([])
  const [escolha, setEscolha] = useState<Record<string, string>>({})
  const [copiado, setCopiado] = useState(false)
  const [migracaoFaltando, setMigracaoFaltando] = useState(false)

  const carregar = useCallback(async () => {
    const supabase = createClient() as any
    const [st, { data: cfg, error: errCfg }, { data: pend }, { data: ev }, { data: cl }] = await Promise.all([
      fetch('/api/asaas/status').then((r) => r.json()).catch(() => null),
      supabase.from('configuracoes_agencia').select('id, asaas_inicio').limit(1).maybeSingle(),
      supabase.from('asaas_pendencias').select('*').eq('resolvida', false).order('created_at', { ascending: false }),
      supabase.from('asaas_eventos').select('id, evento, resultado, erro, created_at').order('created_at', { ascending: false }).limit(15),
      supabase.from('clientes').select('id, nome').order('nome'),
    ])
    setMigracaoFaltando(!!errCfg)
    setStatus(st)
    setConfigId(cfg?.id ?? null)
    setInicioSalvo(cfg?.asaas_inicio ?? null)
    if (cfg?.asaas_inicio) setInicio(cfg.asaas_inicio)
    setPendencias(pend ?? [])
    setEventos(ev ?? [])
    setClientes(cl ?? [])
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function rodar(simular: boolean) {
    setRodando(simular ? 'previa' : 'sync')
    setErro(null)
    try {
      const r = await postJson('/api/asaas/sincronizar', { simular, inicio })
      setSync(r)
      setSimulado(simular)
      if (!simular) await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
    setRodando(null)
  }

  async function salvarInicio(valor: string | null) {
    const supabase = createClient() as any
    const { error } = configId
      ? await supabase.from('configuracoes_agencia').update({ asaas_inicio: valor }).eq('id', configId)
      : await supabase.from('configuracoes_agencia').insert({ asaas_inicio: valor })
    if (error) throw error
    setInicioSalvo(valor)
  }

  async function ativar() {
    setRodando('ativar')
    setErro(null)
    try {
      await salvarInicio(inicio)
      const r = await postJson('/api/asaas/sincronizar', {})
      setSync(r)
      setSimulado(false)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
    setRodando(null)
  }

  async function desativar() {
    setErro(null)
    try { await salvarInicio(null) } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }

  async function resolver(p: Pendencia, acao: { clienteId?: string; lancamentoId?: string; ignorar?: boolean }) {
    setRodando(p.payment_id)
    setErro(null)
    try {
      const r = await postJson('/api/asaas/reprocessar', { paymentId: p.payment_id, ...acao })
      if (r.resultado?.acao === 'pendencia') setErro('Ainda não deu para resolver: ' + (r.resultado.detalhe ?? ''))
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
    setRodando(null)
  }

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/asaas/webhook` : ''
  async function copiarUrl() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const Item = ({ ok, children }: { ok: boolean | undefined; children: React.ReactNode }) => (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-lima mt-0.5" /> : <XCircle className="h-4 w-4 shrink-0 text-brand-rosa mt-0.5" />}
      <span className="text-brand-lavanda/80">{children}</span>
    </li>
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Asaas" description="Integração de cobranças" />
      <main className="flex-1 p-4 md:p-6 space-y-6">
        <Link href="/catalogo" className="inline-flex items-center gap-1.5 text-xs text-brand-lavanda/50 hover:text-brand-lavanda">
          <ArrowLeft className="h-3.5 w-3.5" /> Catálogo Place
        </Link>
        <PageHeader
          title="Integração com o Asaas"
          description="Cobranças e pagamentos do Asaas entram sozinhos no financeiro, sem duplicar o que você já lançou."
        />

        {migracaoFaltando && (
          <p className="text-sm text-brand-rosa">Rode a migration <code>20261008000000_asaas.sql</code> no Supabase antes de continuar.</p>
        )}
        {erro && <p className="text-sm text-brand-rosa">{erro}</p>}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">1. Configuração</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              <Item ok={status?.chave}>Chave de API (<code>ASAAS_API_KEY</code>) {status?.chave ? `configurada · ${status.ambiente === 'sandbox' ? 'sandbox' : 'produção'}` : 'não configurada no servidor'}</Item>
              <Item ok={status?.webhookToken}>Token do webhook (<code>ASAAS_WEBHOOK_TOKEN</code>) {status?.webhookToken ? 'configurado' : 'não configurado no servidor'}</Item>
            </ul>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-sm text-brand-lavanda/70 space-y-2">
              <p>No Asaas, vá em <b>Integrações → Webhooks → Adicionar</b> e preencha:</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-brand-lavanda/50">URL:</span>
                <code className="rounded bg-white/[0.06] px-2 py-1 text-xs text-brand-lavanda break-all">{webhookUrl}</code>
                <Button size="sm" variant="ghost" onClick={copiarUrl}>{copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button>
              </div>
              <p><span className="text-brand-lavanda/50">Token de autenticação:</span> o mesmo valor de <code>ASAAS_WEBHOOK_TOKEN</code>.</p>
              <p><span className="text-brand-lavanda/50">Eventos:</span> todos os de <b>Cobranças</b>. Deixe a fila de sincronização ativada.</p>
              <p className="text-xs text-brand-lavanda/40">A URL precisa ser a do sistema publicado (Vercel). Rodando no seu computador, o Asaas não consegue chamar.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              2. Ativação {inicioSalvo && <Badge variant="aprovada">Ativa desde {formatDate(inicioSalvo)}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="inicio">Valer para cobranças com vencimento a partir de</Label>
                <Input id="inicio" type="date" className="w-48" value={inicio} onChange={(e) => setInicio(e.target.value)} disabled={!!inicioSalvo} />
              </div>
              <div className="flex flex-wrap gap-2">
                {!inicioSalvo ? (
                  <>
                    <Button variant="outline" onClick={() => rodar(true)} disabled={!!rodando || !status?.chave}>
                      {rodando === 'previa' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ver prévia'}
                    </Button>
                    <Button onClick={ativar} disabled={!!rodando || !status?.chave || !sync || !simulado}>
                      {rodando === 'ativar' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ativar integração'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => rodar(false)} disabled={!!rodando || !status?.chave}>
                      {rodando === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizar agora
                    </Button>
                    <Button variant="ghost" onClick={desativar} disabled={!!rodando} className="text-brand-rosa/70 hover:text-brand-rosa">Desativar</Button>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-brand-lavanda/40">
              {inicioSalvo
                ? 'O webhook atualiza tudo sozinho. "Sincronizar agora" busca de novo no Asaas e corrige qualquer aviso perdido — pode rodar à vontade, nada duplica.'
                : 'Veja a prévia primeiro: nada é gravado até você ativar. Cobranças com vencimento anterior à data ficam de fora.'}
            </p>

            {sync && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-medium text-brand-lavanda">{simulado ? 'Prévia' : 'Resultado'} · {sync.total} cobrança(s) desde {formatDate(sync.inicio)}:</span>
                  {Object.entries(sync.resumo).filter(([, n]) => n > 0).map(([acao, n]) => (
                    <Badge key={acao} variant={acaoLabel[acao]?.variant ?? 'default'}>{acaoLabel[acao]?.label ?? acao}: {n}</Badge>
                  ))}
                </div>
                {sync.erros.length > 0 && (
                  <p className="text-xs text-brand-rosa">{sync.erros.length} cobrança(s) com erro: {sync.erros[0].erro}</p>
                )}
                <div className="max-h-[420px] overflow-auto rounded-lg border border-white/[0.06]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-brand-noite">
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-2">Cliente</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-3 py-2">Vencimento</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-2">No Asaas</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-2">No sistema</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-2">O que acontece</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sync.resultados.map((r) => (
                        <tr key={r.paymentId} className="border-b border-white/[0.04]">
                          <td className="px-4 py-2 text-brand-lavanda">{r.cliente ?? '—'}</td>
                          <td className="px-3 py-2 text-xs text-brand-lavanda/60">{formatDate(r.vencimento)}</td>
                          <td className="px-3 py-2 text-right text-brand-lavanda/80">{formatCurrency(r.valorAsaas)}</td>
                          <td className={cn('px-3 py-2 text-right', r.valorSistema != null && Math.abs(r.valorSistema - r.valorAsaas) > 0.009 ? 'text-yellow-400' : 'text-brand-lavanda/60')}>
                            {r.valorSistema != null ? formatCurrency(r.valorSistema) : '—'}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant={acaoLabel[r.acao]?.variant ?? 'default'}>{acaoLabel[r.acao]?.label ?? r.acao}</Badge>
                            {r.detalhe && <p className="text-[11px] text-brand-lavanda/40 mt-0.5">{r.detalhe}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-brand-lavanda/40">Valor em amarelo: diferente do Asaas (taxa/desconto). O lançamento manual mantém o seu valor; só o status passa a vir do Asaas.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              3. Precisa da sua decisão {pendencias.length > 0 && <Badge variant="pendente">{pendencias.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendencias.length === 0 ? (
              <p className="text-sm text-brand-lavanda/40">Nada pendente.</p>
            ) : pendencias.map((p) => {
              const c = p.detalhes.cobranca
              return (
                <div key={p.payment_id} className="rounded-lg border border-white/[0.08] p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-brand-lavanda">{motivoLabel[p.motivo]}</p>
                      <p className="text-xs text-brand-lavanda/50">
                        {p.detalhes.cliente_nome ? `${p.detalhes.cliente_nome} · ` : ''}
                        {c ? `${formatCurrency(c.value)} · vence ${formatDate(c.dueDate)}${c.description ? ` · ${c.description}` : ''}` : p.payment_id}
                      </p>
                    </div>
                  </div>

                  {p.motivo === 'cliente_nao_encontrado' && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select value={escolha[p.payment_id] ?? ''} onValueChange={(v) => setEscolha((e) => ({ ...e, [p.payment_id]: v }))}>
                        <SelectTrigger className="sm:w-72"><SelectValue placeholder="Qual cliente é este?" /></SelectTrigger>
                        <SelectContent>
                          {clientes.map((cl) => <SelectItem key={cl.id} value={cl.id}>{cl.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" disabled={!escolha[p.payment_id] || rodando === p.payment_id} onClick={() => resolver(p, { clienteId: escolha[p.payment_id] })}>
                        {rodando === p.payment_id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ligar e processar'}
                      </Button>
                    </div>
                  )}

                  {p.motivo === 'varios_lancamentos' && (
                    <div className="space-y-1.5">
                      {(p.detalhes.candidatos ?? []).map((l) => (
                        <label key={l.id} className="flex items-center gap-2 text-sm text-brand-lavanda/80">
                          <input type="radio" name={`c-${p.payment_id}`} checked={escolha[p.payment_id] === l.id} onChange={() => setEscolha((e) => ({ ...e, [p.payment_id]: l.id }))} className="accent-brand-lima" />
                          {l.descricao} · {formatCurrency(l.valor)} · {formatDate(l.data)}
                        </label>
                      ))}
                      <Button size="sm" disabled={!escolha[p.payment_id] || rodando === p.payment_id} onClick={() => resolver(p, { lancamentoId: escolha[p.payment_id] })}>
                        {rodando === p.payment_id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ligar a este lançamento'}
                      </Button>
                    </div>
                  )}

                  <Button size="sm" variant="ghost" onClick={() => resolver(p, { ignorar: true })} disabled={rodando === p.payment_id}>
                    {p.motivo === 'cobranca_excluida' ? 'Ok, entendi' : 'Ignorar esta cobrança'}
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Últimos avisos recebidos</CardTitle></CardHeader>
          <CardContent>
            {eventos.length === 0 ? (
              <p className="text-sm text-brand-lavanda/40">Nenhum aviso do Asaas ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {eventos.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-brand-lavanda/40 w-28">{formatDate(e.created_at, 'dd/MM HH:mm')}</span>
                    <code className="text-brand-lavanda/80">{e.evento}</code>
                    {e.resultado && <Badge variant={e.resultado === 'erro' ? 'recusada' : acaoLabel[e.resultado]?.variant ?? 'outline'}>{acaoLabel[e.resultado]?.label ?? e.resultado}</Badge>}
                    {e.erro && <span className="text-brand-rosa">{e.erro}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

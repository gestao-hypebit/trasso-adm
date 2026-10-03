'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import {
  Search, AlertTriangle, CalendarClock, Wallet, CheckCircle2, Download, Trash2,
  RefreshCw, MessageCircle, Check,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LancamentoForm } from '@/components/financeiro/lancamento-form'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { formatCurrency, formatDate, cn, whatsappUrl, addMonthsISO } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { hojeISO, diasEntre, situacaoDe, aging, baixarCSV, type Situacao } from '@/lib/financeiro'
import { SeletorMes, periodoInicial, intervaloPeriodo, rotuloPeriodo, type Periodo } from '@/components/financeiro/seletor-mes'
import { useFrente, filtrarLancamentos, frenteLancamentoOpcoes, type FrenteLancamento } from '@/components/layout/frente'

type Lancamento = {
  id: string; descricao: string; valor: number; data: string; status: string
  forma_pagamento: string | null; recorrente: boolean; frequencia: string | null
  frente: FrenteLancamento
  categorias_financeiras: { nome: string } | null
  clientes: { nome: string; whatsapp: string | null; telefone: string | null } | null
}

type Aba = 'aberto' | 'vencidas' | 'semana' | 'liquidadas' | 'canceladas' | 'todas'

const formaLabel: Record<string, string> = {
  pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto',
  cartao_credito: 'Cartão crédito', cartao_debito: 'Cartão débito', dinheiro: 'Dinheiro',
}

function SituacaoBadge({ situacao, data, hoje, liquidadoLabel }: { situacao: Situacao; data: string; hoje: string; liquidadoLabel: string }) {
  if (situacao === 'vencido') {
    const d = diasEntre(data, hoje)
    return <Badge variant="urgente">Vencida há {d}d</Badge>
  }
  if (situacao === 'hoje') return <Badge variant="pendente">Vence hoje</Badge>
  if (situacao === 'a_vencer') {
    const d = diasEntre(hoje, data)
    return <Badge variant={d <= 7 ? 'pendente' : 'outline'}>Vence em {d}d</Badge>
  }
  if (situacao === 'cancelado') return <Badge variant="inativo">Cancelado</Badge>
  return <Badge variant="concluido">{liquidadoLabel}</Badge>
}

export function ContasPage({ tipo }: { tipo: 'receita' | 'despesa' }) {
  const pathname = usePathname()
  const ehReceber = tipo === 'receita'
  const statusLiquidado = ehReceber ? 'recebido' : 'pago'
  const t = ehReceber
    ? { titulo: 'Contas a Receber', liquidado: 'Recebido', liquidadas: 'Recebidas', baixa: 'Receber', cor: 'text-brand-lima' }
    : { titulo: 'Contas a Pagar', liquidado: 'Pago', liquidadas: 'Pagas', baixa: 'Pagar', cor: 'text-brand-rosa' }

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<Aba>('todas')
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [baixando, setBaixando] = useState(false)
  const hoje = hojeISO()
  const { frente, pronto } = useFrente()

  const load = useCallback(async () => {
    if (!pronto) return
    const { data } = await filtrarLancamentos(
      (createClient() as any)
        .from('lancamentos')
        .select('id, descricao, valor, data, status, forma_pagamento, recorrente, frequencia, frente, categorias_financeiras(nome), clientes(nome, whatsapp, telefone)')
        .eq('tipo', tipo),
      frente,
      { incluirGeral: true },
    ).order('data', { ascending: true })
    setLancamentos((data as Lancamento[]) ?? [])
    setLoading(false)
  }, [tipo, frente, pronto])

  async function mudarFrente(id: string, nova: FrenteLancamento) {
    const anterior = lancamentos.find(l => l.id === id)?.frente
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, frente: nova } : l))
    const { error } = await (createClient() as any).from('lancamentos').update({ frente: nova }).eq('id', id)
    if (error && anterior) setLancamentos(prev => prev.map(l => l.id === id ? { ...l, frente: anterior } : l))
  }

  useEffect(() => { load() }, [load])

  async function darBaixa(ids: string[]) {
    if (!ids.length) return
    setBaixando(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any).from('lancamentos').update({ status: statusLiquidado }).in('id', ids)
    if (!error) {
      setLancamentos(prev => prev.map(l => ids.includes(l.id) ? { ...l, status: statusLiquidado } : l))
      setSelecionados(new Set())
    }
    setBaixando(false)
  }

  async function excluir(id: string) {
    const { error } = await createClient().from('lancamentos').delete().eq('id', id)
    if (!error) setLancamentos(prev => prev.filter(l => l.id !== id))
    setDeletingId(null)
  }

  const abertos = useMemo(() => lancamentos.filter(l => l.status === 'pendente'), [lancamentos])
  const vencidos = abertos.filter(l => l.data < hoje)
  const em7 = abertos.filter(l => l.data >= hoje && diasEntre(hoje, l.data) <= 7)
  const [ini, fim] = intervaloPeriodo(periodo)
  const noPeriodo = lancamentos.filter(l => l.data >= ini && l.data <= fim)
  const liquidadoMes = noPeriodo.filter(l => l.status === statusLiquidado)
  const soma = (arr: Lancamento[]) => arr.reduce((s, l) => s + l.valor, 0)
  const faixas = aging(abertos, hoje)
  const maxFaixa = Math.max(...faixas.map(f => f.valor), 1)

  // Quem mais deve (receber) ou para onde vai o dinheiro (pagar), considerando o que está em aberto.
  const ranking = Object.entries(
    abertos.reduce((acc, l) => {
      const k = ehReceber ? (l.clientes?.nome ?? 'Sem cliente') : (l.categorias_financeiras?.nome ?? 'Sem categoria')
      acc[k] = (acc[k] ?? 0) + l.valor
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // As abas contam só o período escolhido; os cartões do topo mostram a situação de hoje.
  const contagem: Record<Aba, number> = {
    aberto: noPeriodo.filter(l => l.status === 'pendente').length,
    vencidas: noPeriodo.filter(l => l.status === 'pendente' && l.data < hoje).length,
    semana: noPeriodo.filter(l => l.status === 'pendente' && l.data >= hoje && diasEntre(hoje, l.data) <= 7).length,
    liquidadas: liquidadoMes.length,
    canceladas: noPeriodo.filter(l => l.status === 'cancelado').length,
    todas: noPeriodo.length,
  }

  const filtradas = noPeriodo
    .filter((l) => {
      switch (aba) {
        case 'aberto': return l.status === 'pendente'
        case 'vencidas': return l.status === 'pendente' && l.data < hoje
        case 'semana': return l.status === 'pendente' && l.data >= hoje && diasEntre(hoje, l.data) <= 7
        case 'liquidadas': return l.status === statusLiquidado
        case 'canceladas': return l.status === 'cancelado'
        default: return true
      }
    })
    .filter((l) => {
      const q = busca.toLowerCase()
      return !q || l.descricao.toLowerCase().includes(q)
        || (l.clientes?.nome ?? '').toLowerCase().includes(q)
        || (l.categorias_financeiras?.nome ?? '').toLowerCase().includes(q)
    })
    // Em aberto: mais urgente primeiro. Liquidadas: mais recentes primeiro.
    .sort((a, b) => aba === 'liquidadas' ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data))

  const selecionaveis = filtradas.filter(l => l.status === 'pendente')
  const todosSelecionados = selecionaveis.length > 0 && selecionaveis.every(l => selecionados.has(l.id))
  const valorSelecionado = soma(lancamentos.filter(l => selecionados.has(l.id)))

  function toggle(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exportar() {
    baixarCSV(
      `${ehReceber ? 'contas-a-receber' : 'contas-a-pagar'}-${hoje}.csv`,
      ['Vencimento', 'Descrição', ehReceber ? 'Cliente' : 'Categoria', 'Forma de pagamento', 'Valor', 'Situação'],
      filtradas.map(l => [
        formatDate(l.data),
        l.descricao,
        ehReceber ? (l.clientes?.nome ?? '') : (l.categorias_financeiras?.nome ?? ''),
        formaLabel[l.forma_pagamento ?? ''] ?? '',
        l.valor,
        l.status === 'pendente' ? (l.data < hoje ? 'Vencida' : 'Em aberto') : l.status === 'cancelado' ? 'Cancelado' : t.liquidado,
      ]),
    )
  }

  function mensagemCobranca(l: Lancamento) {
    const atraso = diasEntre(l.data, hoje)
    return `Olá${l.clientes?.nome ? `, ${l.clientes.nome.split(' ')[0]}` : ''}! Tudo bem? Passando para lembrar do pagamento de "${l.descricao}" no valor de ${formatCurrency(l.valor)}, ${atraso > 0 ? `vencido em ${formatDate(l.data)}` : `com vencimento em ${formatDate(l.data)}`}. Qualquer dúvida, estou à disposição!`
  }

  const kpis = [
    { label: 'Vencido', valor: soma(vencidos), sub: `${vencidos.length} título(s) em atraso`, icon: AlertTriangle, cor: 'text-brand-rosa', bg: 'bg-brand-rosa/10', aba: 'vencidas' as Aba },
    { label: 'Vence em 7 dias', valor: soma(em7), sub: `${em7.length} título(s)`, icon: CalendarClock, cor: 'text-yellow-400', bg: 'bg-yellow-400/10', aba: 'semana' as Aba },
    { label: 'Total em aberto', valor: soma(abertos), sub: `${abertos.length} título(s)`, icon: Wallet, cor: 'text-brand-lavanda', bg: 'bg-brand-violeta/10', aba: 'aberto' as Aba },
    { label: `${t.liquidado} · ${periodo.tudo ? 'total' : rotuloPeriodo(periodo).toLowerCase()}`, valor: soma(liquidadoMes), sub: `${liquidadoMes.length} baixa(s)`, icon: CheckCircle2, cor: t.cor, bg: ehReceber ? 'bg-brand-lima/10' : 'bg-brand-rosa/10', aba: 'liquidadas' as Aba },
  ]

  const abas: { key: Aba; label: string }[] = [
    { key: 'aberto', label: 'Em aberto' },
    { key: 'vencidas', label: 'Vencidas' },
    { key: 'semana', label: 'Próx. 7 dias' },
    { key: 'liquidadas', label: t.liquidadas },
    { key: 'canceladas', label: 'Canceladas' },
    { key: 'todas', label: 'Todas' },
  ]

  const colunas = ehReceber ? 9 : 8

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" description={t.titulo} />
      <main className="flex-1 p-4 md:p-6">
        <PageHeader title={t.titulo} description={ehReceber ? 'Títulos a receber de clientes, vencimentos e inadimplência' : 'Obrigações da agência, vencimentos e pagamentos'}>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!filtradas.length}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <LancamentoForm defaultTipo={tipo} onSuccess={load} />
        </PageHeader>
        <FinanceiroSubNav pathname={pathname} />

        {/* KPIs — clicar filtra a tabela */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((k) => (
            <button key={k.label} type="button" onClick={() => { setAba(k.aba); if (k.aba !== 'liquidadas') setPeriodo(p => ({ ...p, tudo: true })) }} className="text-left">
              <Card className={cn('transition-colors hover:border-white/[0.14]', aba === k.aba && 'border-white/[0.18]')}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', k.bg)}>
                    <k.icon className={cn('h-5 w-5', k.cor)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-brand-lavanda/50">{k.label}</p>
                    <p className={cn('text-xl font-bold', k.cor)} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                      {loading ? '...' : formatCurrency(k.valor)}
                    </p>
                    <p className="text-[11px] text-brand-lavanda/40">{k.sub}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Aging {ehReceber ? '(inadimplência)' : '(atrasos)'}</CardTitle>
              <p className="text-xs text-brand-lavanda/40">Títulos em aberto por dias de atraso</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {faixas.map((f) => (
                <div key={f.key} className="flex items-center gap-3 text-xs">
                  <span className="w-20 shrink-0 text-brand-lavanda/60">{f.label}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', f.key === 'a_vencer' ? 'bg-brand-violeta' : f.key === '1_30' ? 'bg-yellow-400' : 'bg-brand-rosa')}
                      style={{ width: `${(f.valor / maxFaixa) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-brand-lavanda/40">{f.qtd}</span>
                  <span className="w-28 shrink-0 text-right font-medium text-brand-lavanda">{formatCurrency(f.valor)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{ehReceber ? 'Maiores devedores' : 'Em aberto por categoria'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {ranking.length === 0 ? (
                <p className="text-xs text-brand-lavanda/40 py-6 text-center">Nada em aberto.</p>
              ) : ranking.map(([nome, valor]) => (
                <div key={nome} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-brand-lavanda/70">{nome}</span>
                  <span className="shrink-0 font-medium text-brand-lavanda">{formatCurrency(valor)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mb-4">
          <SeletorMes valor={periodo} onChange={(p) => { setPeriodo(p); setAba('todas'); setSelecionados(new Set()) }} permitirFuturo />
        </div>

        {/* Abas de situação */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {abas.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => { setAba(a.key); setSelecionados(new Set()) }}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                aba === a.key ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/40 hover:text-brand-lavanda/70 hover:bg-white/[0.04]'
              )}
            >
              {a.label}
              <span className={cn('rounded-full px-1.5 text-[10px] leading-4', a.key === 'vencidas' && contagem.vencidas > 0 ? 'bg-brand-rosa/15 text-brand-rosa' : 'bg-white/[0.06] text-brand-lavanda/50')}>
                {contagem[a.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
            <Input className="pl-9" placeholder={ehReceber ? 'Buscar por descrição, cliente ou categoria...' : 'Buscar por descrição ou categoria...'} value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>

        {selecionados.size > 0 && (
          <div className="flex items-center justify-between gap-3 mb-3 rounded-xl border border-brand-lima/20 bg-brand-lima/[0.05] px-4 py-2.5">
            <p className="text-sm text-brand-lavanda">
              {selecionados.size} selecionado(s) · <span className="font-semibold">{formatCurrency(valorSelecionado)}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>Limpar</Button>
              <Button size="sm" onClick={() => darBaixa([...selecionados])} disabled={baixando}>
                <Check className="h-4 w-4" /> {baixando ? 'Salvando...' : `Dar baixa (${t.liquidado.toLowerCase()})`}
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="w-10 pl-4 py-3">
                      <input
                        type="checkbox"
                        className="accent-[#B8F000] cursor-pointer disabled:cursor-default"
                        checked={todosSelecionados}
                        disabled={!selecionaveis.length}
                        onChange={() => setSelecionados(todosSelecionados ? new Set() : new Set(selecionaveis.map(l => l.id)))}
                      />
                    </th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-3 py-3">Vencimento</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-3 py-3">Descrição</th>
                    {ehReceber && <th className="text-left text-xs text-brand-lavanda/50 font-medium px-3 py-3">Cliente</th>}
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-3 py-3">Categoria · frente</th>
                    <th className="text-left text-xs text-brand-lavanda/50 font-medium px-3 py-3">Forma</th>
                    <th className="text-right text-xs text-brand-lavanda/50 font-medium px-3 py-3">Valor</th>
                    <th className="text-center text-xs text-brand-lavanda/50 font-medium px-3 py-3">Situação</th>
                    <th className="w-36" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={colunas} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</td></tr>
                  ) : filtradas.length === 0 ? (
                    <tr><td colSpan={colunas} className="px-6 py-12 text-center text-brand-lavanda/40 text-sm">Nenhum título nesta visão.</td></tr>
                  ) : filtradas.map((l) => {
                    const situacao = situacaoDe(l.status, l.data, hoje)
                    const zap = ehReceber && situacao !== 'liquidado' && situacao !== 'cancelado'
                      ? whatsappUrl(l.clientes?.whatsapp ?? l.clientes?.telefone, mensagemCobranca(l))
                      : null
                    return (
                      <tr key={l.id} className={cn('border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group', selecionados.has(l.id) && 'bg-brand-lima/[0.03]')}>
                        <td className="pl-4 py-3">
                          {l.status === 'pendente' && (
                            <input type="checkbox" className="accent-[#B8F000] cursor-pointer" checked={selecionados.has(l.id)} onChange={() => toggle(l.id)} />
                          )}
                        </td>
                        <td className={cn('px-3 py-3 whitespace-nowrap text-xs', situacao === 'vencido' ? 'text-brand-rosa font-medium' : 'text-brand-lavanda/60')}>
                          {formatDate(l.data)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 max-w-xs">
                            {l.recorrente && <RefreshCw className="h-3 w-3 shrink-0 text-brand-violeta" aria-label="Recorrente" />}
                            <span className="text-brand-lavanda font-medium truncate">{l.descricao}</span>
                          </div>
                        </td>
                        {ehReceber && <td className="px-3 py-3 text-brand-lavanda/70 whitespace-nowrap">{l.clientes?.nome ?? '—'}</td>}
                        <td className="px-3 py-3 text-xs text-brand-lavanda/60 whitespace-nowrap">
                          {l.categorias_financeiras?.nome ?? '—'}
                          <select
                            value={l.frente}
                            onChange={(e) => mudarFrente(l.id, e.target.value as FrenteLancamento)}
                            onClick={(e) => e.stopPropagation()}
                            title="Frente"
                            className="mt-0.5 block bg-transparent text-[11px] text-brand-lavanda/40 hover:text-brand-lavanda outline-none cursor-pointer"
                          >
                            {frenteLancamentoOpcoes.map(f => <option key={f.value} value={f.value} className="bg-brand-noite">{f.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-3 text-xs text-brand-lavanda/50 whitespace-nowrap">{formaLabel[l.forma_pagamento ?? ''] ?? '—'}</td>
                        <td className={cn('px-3 py-3 text-right font-semibold whitespace-nowrap', l.status === 'cancelado' ? 'text-brand-lavanda/30 line-through' : t.cor)}>
                          {formatCurrency(l.valor)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <SituacaoBadge situacao={situacao} data={l.data} hoje={hoje} liquidadoLabel={t.liquidado} />
                        </td>
                        <td className="px-3 py-3">
                          {deletingId === l.id ? (
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <button onClick={() => excluir(l.id)} className="text-xs text-brand-rosa hover:text-brand-rosa/80 font-medium">Excluir</button>
                              <span className="text-brand-lavanda/20">·</span>
                              <button onClick={() => setDeletingId(null)} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70">Cancelar</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {zap && (
                                <a href={zap} target="_blank" rel="noopener noreferrer" title="Cobrar pelo WhatsApp"
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-brand-lavanda/30 hover:text-brand-lima hover:bg-brand-lima/10 transition-colors">
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {l.status === 'pendente' && (
                                <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 border-brand-lima/30 text-brand-lima hover:bg-brand-lima/10"
                                  onClick={() => darBaixa([l.id])} disabled={baixando}>
                                  <Check className="h-3 w-3" /> {t.baixa}
                                </Button>
                              )}
                              <button
                                onClick={() => setDeletingId(l.id)}
                                title="Excluir"
                                className="flex h-7 w-7 items-center justify-center rounded-md text-brand-lavanda/0 group-hover:text-brand-lavanda/25 hover:!text-brand-rosa hover:bg-brand-rosa/10 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {filtradas.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-white/[0.06]">
                      <td colSpan={colunas - 3} className="px-6 py-3 text-xs text-brand-lavanda/40">
                        {filtradas.length} título{filtradas.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-brand-lavanda whitespace-nowrap">
                        {formatCurrency(soma(filtradas.filter(l => l.status !== 'cancelado')))}
                      </td>
                      <td /><td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

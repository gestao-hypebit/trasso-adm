'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Repeat, Users, UserPlus, UserMinus, AlertTriangle, Search, MessageCircle, Download, PlugZap, ChevronRight, Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssinantePainel, type Assinante } from '@/components/catalogo/assinante-painel'
import { createClient } from '@/lib/supabase/client'
import { calcularMrr, type LancamentoMrr } from '@/lib/mrr'
import { hojeISO, diasEntre, baixarCSV } from '@/lib/financeiro'
import { cicloLabel, formaLabel, valorMensal, type AssinaturaAsaas } from '@/lib/asaas/rotulos'
import { cn, formatCurrency, formatDate, whatsappUrl } from '@/lib/utils'

type Cliente = {
  id: string; nome: string; empresa: string | null; whatsapp: string | null; telefone: string | null
  status: string; created_at: string; tipo: string; asaas_customer_id?: string | null
}
type Lanc = LancamentoMrr & { categoria_id: string | null }

type Aba = 'ativos' | 'aguardando' | 'atraso' | 'sem_mensalidade' | 'so_asaas' | 'todos'
type Ordem = 'vencimento' | 'nome' | 'nome_desc' | 'mensalidade_desc' | 'mensalidade' | 'atraso' | 'antigos' | 'recentes'

const ordens: { value: Ordem; label: string }[] = [
  { value: 'vencimento', label: 'Próximo vencimento' },
  { value: 'nome', label: 'Nome (A–Z)' },
  { value: 'nome_desc', label: 'Nome (Z–A)' },
  { value: 'mensalidade_desc', label: 'Maior mensalidade' },
  { value: 'mensalidade', label: 'Menor mensalidade' },
  { value: 'atraso', label: 'Maior atraso' },
  { value: 'antigos', label: 'Assinantes mais antigos' },
  { value: 'recentes', label: 'Assinantes mais recentes' },
]

const mesLabel = (mesKey: string | null) => {
  if (!mesKey) return '—'
  const [y, m] = mesKey.split('-')
  return `${m}/${y.slice(2)}`
}

const ativa = (s: AssinaturaAsaas) => s.status === 'ACTIVE'

// No Asaas também há assinaturas da agência (software, social…). Cliente do tipo
// "saas" só tem Catálogo; cliente "ambos" pode ter as duas, então lá só conta a
// assinatura que diz "Catálogo" na descrição.
const CATALOGO_RE = /cat[aá]logo/i
const ehDoCatalogo = (s: AssinaturaAsaas, tipoCliente: string) => tipoCliente === 'saas' || CATALOGO_RE.test(s.descricao ?? '')

// Assinaturas que contam para o Catálogo (para quem só está no Asaas, todas).
const doCatalogo = (l: Assinante) => (l.soNoAsaas ? l.assinaturas : l.assinaturas.filter((s) => l.idsCatalogo.includes(s.id)))
const assinaturaAtiva = (l: Assinante) => doCatalogo(l).find(ativa)

// Próxima cobrança da assinatura ativa do Catálogo (nulo = sem assinatura ativa no Asaas).
const proximaCobranca = (l: Assinante) => assinaturaAtiva(l)?.proximoVencimento ?? null

// Quem não tem o dado usado na ordenação vai para o fim da lista.
function comparar(a: Assinante, b: Assinante, ordem: Ordem): number {
  const vaziosNoFim = (x: string | null, y: string | null, sentido: 1 | -1) =>
    x && y ? x.localeCompare(y) * sentido : x ? -1 : y ? 1 : 0
  switch (ordem) {
    case 'vencimento': return vaziosNoFim(proximaCobranca(a), proximaCobranca(b), 1)
    case 'nome': return a.nome.localeCompare(b.nome, 'pt-BR')
    case 'nome_desc': return b.nome.localeCompare(a.nome, 'pt-BR')
    case 'mensalidade_desc': return b.mensalidade - a.mensalidade
    case 'mensalidade': return (a.mensalidade || Infinity) - (b.mensalidade || Infinity) || 0
    case 'atraso': return b.atraso - a.atraso || b.diasAtraso - a.diasAtraso
    case 'antigos': return vaziosNoFim(a.desde, b.desde, 1)
    case 'recentes': return vaziosNoFim(a.desde, b.desde, -1)
  }
}

export default function CatalogoPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [lancamentos, setLancamentos] = useState<Lanc[]>([])
  const [recorrentes, setRecorrentes] = useState<string[]>([])
  // asaas_customer_id de todos os clientes (agência inclusive), para saber o que já está ligado.
  const [ligadosAsaas, setLigadosAsaas] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [asaas, setAsaas] = useState<{ configurado: boolean; assinaturas: AssinaturaAsaas[] } | null>(null)
  const [erroAsaas, setErroAsaas] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<Aba>('ativos')
  const [ordem, setOrdem] = useState<Ordem>('vencimento')
  const [aberto, setAberto] = useState<string | null>(null)
  const hoje = hojeISO()

  const carregar = useCallback(async () => {
    const supabase = createClient() as any
    const camposCliente = 'id, nome, empresa, whatsapp, telefone, status, created_at, tipo'
    const [resClientes, { data: l, error }, { data: cats }, { data: ligados }] = await Promise.all([
      supabase.from('clientes').select(`${camposCliente}, asaas_customer_id`).in('tipo', ['saas', 'ambos']).order('nome'),
      supabase.from('lancamentos')
        .select('valor, data, status, descricao, cliente_id, categoria_id, clientes(nome, whatsapp, telefone), categorias_financeiras(nome)')
        .eq('tipo', 'receita')
        .eq('frente', 'catalogo_place'),
      supabase.from('categorias_financeiras').select('id').eq('tipo', 'receita').eq('recorrente', true),
      supabase.from('clientes').select('asaas_customer_id').not('asaas_customer_id', 'is', null),
    ])
    // Sem a migration do Asaas a coluna não existe: carrega sem ela.
    let c = resClientes.data
    if (resClientes.error) {
      const r = await supabase.from('clientes').select(camposCliente).in('tipo', ['saas', 'ambos']).order('nome')
      c = r.data
    }
    if (error) setErro('Não foi possível carregar as mensalidades. A migration de frentes (20261007000000_frentes.sql) já foi aplicada no Supabase?')
    setClientes(c ?? [])
    setLancamentos(l ?? [])
    setRecorrentes((cats ?? []).map((x: { id: string }) => x.id))
    setLigadosAsaas(new Set((ligados ?? []).map((x: { asaas_customer_id: string }) => x.asaas_customer_id)))
    setLoading(false)
  }, [])

  // O Asaas é mais lento: carrega à parte para a tela não esperar por ele.
  const carregarAsaas = useCallback(async () => {
    setErroAsaas(null)
    try {
      const r = await fetch('/api/asaas/assinaturas')
      const json = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(json.error ?? `Erro ${r.status}`)
      setAsaas(json)
    } catch (e) {
      setErroAsaas(e instanceof Error ? e.message : 'Falha ao falar com o Asaas.')
      setAsaas({ configurado: true, assinaturas: [] })
    }
  }, [])

  useEffect(() => { carregar(); carregarAsaas() }, [carregar, carregarAsaas])

  const calc = useMemo(() => {
    const mensalidades = lancamentos.filter((l) => l.categoria_id && recorrentes.includes(l.categoria_id))
    const mrr = calcularMrr(mensalidades, hoje)
    const assinaturas = asaas?.assinaturas ?? []
    // Assinaturas do cliente: as do Catálogo primeiro, ativas antes das canceladas.
    const assinaturasDo = (c: Cliente) => {
      if (!c.asaas_customer_id) return { todas: [] as AssinaturaAsaas[], catalogo: [] as AssinaturaAsaas[] }
      const peso = (s: AssinaturaAsaas) => Number(ehDoCatalogo(s, c.tipo)) * 2 + Number(ativa(s))
      const todas = assinaturas.filter((s) => s.customerId === c.asaas_customer_id).sort((a, b) => peso(b) - peso(a))
      return { todas, catalogo: todas.filter((s) => ehDoCatalogo(s, c.tipo)) }
    }
    const asaasCarregado = !!asaas?.configurado && !erroAsaas && asaas.assinaturas.length > 0

    // Em atraso: qualquer receita do Catálogo pendente e vencida.
    const atrasoPorChave = new Map<string, { valor: number; maisAntigo: string }>()
    const historicoPorCliente = new Map<string, Assinante['historico']>()
    for (const l of lancamentos) {
      if (!l.cliente_id) continue
      const h = historicoPorCliente.get(l.cliente_id) ?? []
      h.push({ data: l.data, valor: Number(l.valor), status: l.status, descricao: l.descricao })
      historicoPorCliente.set(l.cliente_id, h)
      if (l.status !== 'pendente' || l.data >= hoje) continue
      const a = atrasoPorChave.get(l.cliente_id) ?? { valor: 0, maisAntigo: l.data }
      a.valor += Number(l.valor)
      if (l.data < a.maisAntigo) a.maisAntigo = l.data
      atrasoPorChave.set(l.cliente_id, a)
    }
    const historico = (id: string) => (historicoPorCliente.get(id) ?? []).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 24)

    const ativosPorChave = new Map(mrr.ativos.map((a) => [a.chave, a]))
    const linhas: Assinante[] = clientes.map((c) => {
      const a = ativosPorChave.get(c.id)
      const atraso = atrasoPorChave.get(c.id)
      const subs = assinaturasDo(c)
      // Tem assinatura do Catálogo no Asaas → valor e situação vêm de lá (valor cheio,
      // convertido para mensal; cancelou no Asaas = saiu). Senão, dos lançamentos.
      const peloAsaas = asaasCarregado && subs.catalogo.length > 0
      const ativasCatalogo = subs.catalogo.filter(ativa)
      return {
        chave: c.id, clienteId: c.id, nome: c.nome, empresa: c.empresa, whatsapp: c.whatsapp ?? c.telefone,
        mensalidade: peloAsaas ? ativasCatalogo.reduce((t, s) => t + valorMensal(s), 0) : a?.valorMensal ?? 0,
        desde: a?.desde ?? null, mesesPagos: a?.mesesPagos ?? 0,
        pagoEsteMes: a?.pagoEsteMes ?? false, ativo: peloAsaas ? ativasCatalogo.length > 0 : !!a,
        atraso: atraso?.valor ?? 0, diasAtraso: atraso ? diasEntre(atraso.maisAntigo, hoje) : 0, status: c.status,
        asaasCustomerId: c.asaas_customer_id ?? null, assinaturas: subs.todas, idsCatalogo: subs.catalogo.map((s) => s.id),
        fonte: peloAsaas ? 'asaas' : 'financeiro',
        historico: historico(c.id), soNoAsaas: false,
      }
    })
    // Mensalidades lançadas sem cliente vinculado (identificadas pela descrição).
    for (const a of mrr.ativos) {
      if (clientes.some((c) => c.id === a.chave)) continue
      linhas.push({
        chave: a.chave, clienteId: a.chave.startsWith('d:') ? null : a.chave, nome: a.nome, empresa: null, whatsapp: a.whatsapp,
        mensalidade: a.valorMensal, desde: a.desde, mesesPagos: a.mesesPagos, pagoEsteMes: a.pagoEsteMes, ativo: true,
        atraso: 0, diasAtraso: 0, status: null, asaasCustomerId: null, assinaturas: [], idsCatalogo: [], fonte: 'financeiro',
        historico: [], soNoAsaas: false,
      })
    }
    // Assinaturas do Asaas que nenhum cliente do sistema tem.
    const soAsaas = new Map<string, AssinaturaAsaas[]>()
    for (const s of assinaturas) {
      if (ligadosAsaas.has(s.customerId)) continue
      soAsaas.set(s.customerId, [...(soAsaas.get(s.customerId) ?? []), s])
    }
    for (const [customerId, subs] of soAsaas) {
      const s0 = subs[0]
      linhas.push({
        chave: `a:${customerId}`, clienteId: null, nome: s0.customerNome ?? 'Cliente do Asaas', empresa: s0.customerEmail,
        whatsapp: s0.customerTelefone,
        mensalidade: subs.filter(ativa).reduce((t, s) => t + valorMensal(s), 0), desde: null, mesesPagos: 0,
        pagoEsteMes: false, ativo: subs.some(ativa), atraso: 0, diasAtraso: 0, status: null,
        asaasCustomerId: customerId, assinaturas: subs.sort((a, b) => Number(ativa(b)) - Number(ativa(a))),
        idsCatalogo: subs.filter((s) => CATALOGO_RE.test(s.descricao ?? '')).map((s) => s.id), fonte: 'asaas',
        historico: [], soNoAsaas: true,
      })
    }

    const doSistema = linhas.filter((l) => !l.soNoAsaas)
    const emAtraso = doSistema.filter((l) => l.atraso > 0)
    const ativas = doSistema.filter((l) => l.ativo)
    // Assinaturas de clientes "ambos" sem "Catálogo" na descrição: ficam fora do MRR.
    const foraDoCatalogo = clientes
      .filter((c) => c.tipo === 'ambos')
      .flatMap((c) => assinaturasDo(c).todas.filter((s) => ativa(s) && !ehDoCatalogo(s, c.tipo))).length
    return {
      mrr, linhas,
      mrrCatalogo: ativas.reduce((t, l) => t + l.mensalidade, 0),
      viaAsaas: ativas.filter((l) => l.fonte === 'asaas').length,
      viaFinanceiro: ativas.filter((l) => l.fonte === 'financeiro').length,
      foraDoCatalogo,
      asaasCarregado,
      totalAtraso: emAtraso.reduce((s, l) => s + l.atraso, 0),
      // Assinaturas = quem tem mensalidade recente ou está devendo.
      totalAssinaturas: doSistema.filter((l) => l.ativo || l.atraso > 0).length,
      inadimplentes: emAtraso.length,
      contagem: {
        ativos: doSistema.filter((l) => l.ativo).length,
        aguardando: doSistema.filter((l) => l.ativo && !l.pagoEsteMes).length,
        atraso: emAtraso.length,
        sem_mensalidade: doSistema.filter((l) => !l.ativo && l.status !== 'inativo').length,
        so_asaas: linhas.length - doSistema.length,
        todos: linhas.length,
      } as Record<Aba, number>,
      semCliente: doSistema.filter((l) => !l.clienteId).length,
      clientesSemAsaas: clientes.filter((c) => !c.asaas_customer_id).map((c) => ({ id: c.id, nome: c.nome })),
      customersSemCliente: [...soAsaas.entries()].map(([id, subs]) => ({
        id, nome: `${subs[0].customerNome ?? id} · ${formatCurrency(subs[0].valor)}/${cicloLabel[subs[0].ciclo] ?? subs[0].ciclo}`,
      })),
    }
  }, [clientes, lancamentos, recorrentes, asaas, erroAsaas, ligadosAsaas, hoje])

  const termo = busca.toLowerCase()
  const visiveis = calc.linhas
    .filter((l) => {
      if (aba === 'so_asaas') return l.soNoAsaas
      if (aba === 'todos') return true
      if (l.soNoAsaas) return false
      if (aba === 'ativos') return l.ativo
      if (aba === 'aguardando') return l.ativo && !l.pagoEsteMes
      if (aba === 'atraso') return l.atraso > 0
      return !l.ativo && l.status !== 'inativo'
    })
    .filter((l) => !termo || [l.nome, l.empresa].some((v) => v?.toLowerCase().includes(termo)))
    .sort((a, b) => comparar(a, b, ordem) || a.nome.localeCompare(b.nome, 'pt-BR'))

  const abas: { key: Aba; label: string }[] = [
    { key: 'ativos', label: 'Ativas' },
    { key: 'aguardando', label: 'Aguardando este mês' },
    { key: 'atraso', label: 'Inadimplentes' },
    { key: 'sem_mensalidade', label: 'Sem mensalidade' },
    ...(calc.contagem.so_asaas > 0 ? [{ key: 'so_asaas' as Aba, label: 'Só no Asaas' }] : []),
    { key: 'todos', label: 'Todos' },
  ]

  function exportar() {
    baixarCSV(
      `catalogo-place-${hoje}.csv`,
      ['Cliente', 'Empresa', 'Mensalidade', 'Desde', 'Meses pagos', 'Pago este mês', 'Em atraso', 'Próxima cobrança (Asaas)'],
      visiveis.map((l) => {
        const s = assinaturaAtiva(l)
        return [l.nome, l.empresa ?? '', l.mensalidade, mesLabel(l.desde), String(l.mesesPagos), l.pagoEsteMes ? 'Sim' : 'Não', l.atraso, s ? formatDate(s.proximoVencimento) : '']
      }),
    )
  }

  const mov = calc.mrr.mesAtual
  const passado = calc.mrr.mesPassado
  const selecionado = calc.linhas.find((l) => l.chave === aberto) ?? null
  const asaasCarregando = asaas === null
  const asaasLigado = !!asaas?.configurado

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Catálogo Place" description="Assinantes e mensalidades" />

      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="Catálogo Place" description="Assinantes, mensalidades e faturas do Asaas">
          <Button variant="outline" size="sm" asChild><Link href="/catalogo/asaas"><PlugZap className="h-4 w-4" /> Integração Asaas</Link></Button>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!visiveis.length}><Download className="h-4 w-4" /> Exportar CSV</Button>
        </PageHeader>

        {erro && <p className="mb-4 text-sm text-brand-rosa">{erro}</p>}
        {erroAsaas && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-4 py-2.5 text-sm text-brand-lavanda/80">
            <span><AlertTriangle className="mr-1.5 inline h-4 w-4 text-yellow-400" />Não deu para buscar as assinaturas no Asaas: {erroAsaas}</span>
            <Button size="sm" variant="ghost" onClick={carregarAsaas}>Tentar de novo</Button>
          </div>
        )}
        {asaas && !asaas.configurado && (
          <p className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-brand-lavanda/50">
            O Asaas não está configurado no servidor: a lista usa só os lançamentos do financeiro. Veja em <Link href="/catalogo/asaas" className="text-brand-lima hover:underline">Integração Asaas</Link>.
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                title="MRR"
                value={formatCurrency(calc.mrrCatalogo)}
                icon={Repeat}
                iconColor="text-brand-lima"
                sub={asaasCarregando
                  ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> buscando no Asaas…</span>
                  : calc.asaasCarregado
                    ? <span title={`${calc.viaAsaas} pelo Asaas, ${calc.viaFinanceiro} pelos lançamentos (fora do Asaas). No financeiro, que soma valores líquidos, o MRR lançado é ${formatCurrency(calc.mrr.mrr)}.`}>
                        Pelo Asaas · financeiro {formatCurrency(calc.mrr.mrr)}
                      </span>
                    : 'Pelos lançamentos do financeiro'}
              />
              <KpiCard
                title="Assinaturas"
                value={String(calc.totalAssinaturas)}
                icon={Users}
                sub={<>
                  <span className="text-brand-lima/80">{calc.totalAssinaturas - calc.inadimplentes} em dia</span>
                  {' · '}
                  <span className={calc.inadimplentes > 0 ? 'text-brand-rosa' : undefined}>{calc.inadimplentes} inadimplente{calc.inadimplentes === 1 ? '' : 's'}</span>
                </>}
              />
              <KpiCard title="Novos este mês" value={String(mov.novos)} icon={UserPlus} />
              <KpiCard title="Cancelaram mês passado" value={String(passado.churn)} icon={UserMinus} iconColor={passado.churn > 0 ? 'text-brand-rosa' : 'text-brand-lavanda/40'} />
              <button type="button" onClick={() => setAba('atraso')} className="text-left" title="Ver inadimplentes">
                <KpiCard
                  title="Inadimplência"
                  value={formatCurrency(calc.totalAtraso)}
                  icon={AlertTriangle}
                  iconColor={calc.totalAtraso > 0 ? 'text-brand-rosa' : 'text-brand-lavanda/40'}
                  sub={calc.inadimplentes > 0
                    ? <span className="text-brand-rosa/80">{calc.inadimplentes} cliente{calc.inadimplentes === 1 ? '' : 's'} em atraso · ver lista</span>
                    : 'Ninguém em atraso'}
                />
              </button>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {abas.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setAba(key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                      aba === key ? 'border-brand-lima bg-brand-lima/20 text-brand-lima' : 'border-white/[0.1] bg-white/[0.04] text-brand-lavanda/70 hover:text-brand-lavanda',
                      key === 'atraso' && calc.contagem.atraso > 0 && aba !== key && 'border-brand-rosa/30 text-brand-rosa'
                    )}
                  >
                    {label}<span className="rounded-full bg-white/[0.06] px-1.5">{calc.contagem[key]}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 lg:w-64 lg:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
                  <Input className="pl-9" placeholder="Buscar assinante..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
                  <SelectTrigger className="w-auto min-w-48" aria-label="Ordenar por"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ordens.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Assinante</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Mensalidade</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Próxima cobrança</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Este mês</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Em atraso</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-brand-lavanda/40">Nenhum assinante nesta lista.</td></tr>
                      ) : visiveis.map((l) => {
                        const cobranca = l.atraso > 0
                          ? `Oi ${l.nome.split(' ')[0]}! Tudo bem? Identificamos ${formatCurrency(l.atraso)} em aberto da sua mensalidade do Catálogo Place. Consegue verificar?`
                          : `Oi ${l.nome.split(' ')[0]}! Passando para lembrar da mensalidade do Catálogo Place deste mês.`
                        const wa = !l.soNoAsaas && (!l.pagoEsteMes || l.atraso > 0) && l.ativo ? whatsappUrl(l.whatsapp, cobranca) : null
                        const sub = assinaturaAtiva(l)
                        const cancelada = doCatalogo(l).length > 0 && !sub
                        return (
                          <tr
                            key={l.chave}
                            onClick={() => setAberto(l.chave)}
                            className="group cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                          >
                            <td className="px-6 py-3">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-medium text-brand-lavanda group-hover:text-brand-lima transition-colors">{l.nome}</span>
                                {l.soNoAsaas && <Badge variant="pendente">Sem cliente ligado</Badge>}
                                {!l.soNoAsaas && !l.clienteId && <Badge variant="pendente">Sem cliente vinculado</Badge>}
                                {cancelada && <Badge variant="inativo">Assinatura cancelada</Badge>}
                              </div>
                              {l.empresa && <p className="text-xs text-brand-lavanda/40">{l.empresa}</p>}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className="text-brand-lavanda">{l.mensalidade ? formatCurrency(l.mensalidade) : '—'}</span>
                              {sub && sub.ciclo !== 'MONTHLY' && (
                                <span className="block text-[11px] text-brand-lavanda/40">{formatCurrency(sub.valor)} {cicloLabel[sub.ciclo] ?? sub.ciclo}</span>
                              )}
                              {l.desde && <span className="block text-[11px] text-brand-lavanda/40">desde {mesLabel(l.desde)}</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                              {sub ? (
                                <>
                                  <span className="text-brand-lavanda/80">{formatDate(sub.proximoVencimento)}</span>
                                  <span className="block text-[11px] text-brand-lavanda/40">{formaLabel[sub.formaPagamento] ?? sub.formaPagamento}</span>
                                </>
                              ) : asaasCarregando && l.asaasCustomerId ? (
                                <Loader2 className="h-3 w-3 animate-spin text-brand-lavanda/30" />
                              ) : (
                                <span className="text-brand-lavanda/30">{asaasLigado && !l.asaasCustomerId && !l.soNoAsaas ? 'Fora do Asaas' : '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {l.soNoAsaas ? (
                                <span className="text-xs text-brand-lavanda/30">—</span>
                              ) : !l.ativo ? (
                                <Badge variant="inativo">{l.status === 'inativo' ? 'Inativo' : 'Sem mensalidade'}</Badge>
                              ) : l.pagoEsteMes ? (
                                <Badge variant="aprovada">Pago</Badge>
                              ) : (
                                <Badge variant="pendente">Aguardando</Badge>
                              )}
                            </td>
                            <td className={cn('px-4 py-3 text-right whitespace-nowrap', l.atraso > 0 ? 'text-brand-rosa font-medium' : 'text-brand-lavanda/30')}>
                              {l.atraso > 0 ? <>{formatCurrency(l.atraso)}<span className="block text-[11px] font-normal text-brand-rosa/70">há {l.diasAtraso} dias</span></> : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {wa && (
                                  <Button size="sm" variant="ghost" asChild onClick={(e) => e.stopPropagation()}>
                                    <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> Cobrar</a>
                                  </Button>
                                )}
                                <ChevronRight className="h-4 w-4 text-brand-lavanda/20 group-hover:text-brand-lavanda/60 transition-colors" />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <p className="text-[11px] text-brand-lavanda/40">
              Clique num assinante para ver a assinatura e as faturas do Asaas.
              MRR = soma das assinaturas do Catálogo ativas no Asaas (valor cheio, planos não mensais convertidos para mensal); quem não está no Asaas entra pelo valor lançado no financeiro.
              {calc.foraDoCatalogo > 0 && ` ${calc.foraDoCatalogo} assinatura(s) de clientes "Agência + Catálogo" sem "Catálogo" na descrição ficaram de fora (são consideradas da agência).`} Ativas = tem mensalidade lançada neste mês ou no anterior. Inadimplentes = tem mensalidade vencida e não paga.
              &quot;Sem mensalidade&quot; = cliente do Catálogo sem mensalidade recente: pode ter cancelado ou faltar lançar.
              {calc.semCliente > 0 && ` ${calc.semCliente} assinante(s) aparecem só pela descrição do lançamento, sem cliente cadastrado; nos próximos lançamentos, escolha o cliente.`}
            </p>
          </div>
        )}
      </main>

      <AssinantePainel
        assinante={selecionado}
        onClose={() => setAberto(null)}
        asaasConfigurado={asaasLigado}
        clientesSemAsaas={calc.clientesSemAsaas}
        customersSemCliente={calc.customersSemCliente}
        onAlterado={() => { carregar(); carregarAsaas() }}
      />
    </div>
  )
}

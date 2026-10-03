'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Repeat, Users, UserPlus, UserMinus, AlertTriangle, Search, MessageCircle, Download, PlugZap } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { calcularMrr, type LancamentoMrr } from '@/lib/mrr'
import { hojeISO, diasEntre, baixarCSV } from '@/lib/financeiro'
import { cn, formatCurrency, whatsappUrl } from '@/lib/utils'

type Cliente = { id: string; nome: string; empresa: string | null; whatsapp: string | null; telefone: string | null; status: string; created_at: string }
type Lanc = LancamentoMrr & { categoria_id: string | null }

type Linha = {
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
}

type Aba = 'ativos' | 'aguardando' | 'atraso' | 'sem_mensalidade' | 'todos'

const mesLabel = (mesKey: string | null) => {
  if (!mesKey) return '—'
  const [y, m] = mesKey.split('-')
  return `${m}/${y.slice(2)}`
}

export default function CatalogoPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [lancamentos, setLancamentos] = useState<Lanc[]>([])
  const [recorrentes, setRecorrentes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<Aba>('ativos')
  const hoje = hojeISO()

  useEffect(() => {
    async function load() {
      const supabase = createClient() as any
      const [{ data: c }, { data: l, error }, { data: cats }] = await Promise.all([
        supabase.from('clientes').select('id, nome, empresa, whatsapp, telefone, status, created_at').in('tipo', ['saas', 'ambos']).order('nome'),
        supabase.from('lancamentos')
          .select('valor, data, status, descricao, cliente_id, categoria_id, clientes(nome, whatsapp, telefone), categorias_financeiras(nome)')
          .eq('tipo', 'receita')
          .eq('frente', 'catalogo_place'),
        supabase.from('categorias_financeiras').select('id').eq('tipo', 'receita').eq('recorrente', true),
      ])
      if (error) setErro('Não foi possível carregar as mensalidades. A migration de frentes (20261007000000_frentes.sql) já foi aplicada no Supabase?')
      setClientes(c ?? [])
      setLancamentos(l ?? [])
      setRecorrentes((cats ?? []).map((x: { id: string }) => x.id))
      setLoading(false)
    }
    load()
  }, [])

  const calc = useMemo(() => {
    const mensalidades = lancamentos.filter((l) => l.categoria_id && recorrentes.includes(l.categoria_id))
    const mrr = calcularMrr(mensalidades, hoje)

    // Em atraso: qualquer receita do Catálogo pendente e vencida.
    const atrasoPorChave = new Map<string, { valor: number; maisAntigo: string }>()
    for (const l of lancamentos) {
      if (l.status !== 'pendente' || l.data >= hoje || !l.cliente_id) continue
      const a = atrasoPorChave.get(l.cliente_id) ?? { valor: 0, maisAntigo: l.data }
      a.valor += Number(l.valor)
      if (l.data < a.maisAntigo) a.maisAntigo = l.data
      atrasoPorChave.set(l.cliente_id, a)
    }

    const ativosPorChave = new Map(mrr.ativos.map((a) => [a.chave, a]))
    const linhas: Linha[] = clientes.map((c) => {
      const a = ativosPorChave.get(c.id)
      const atraso = atrasoPorChave.get(c.id)
      return {
        chave: c.id, clienteId: c.id, nome: c.nome, empresa: c.empresa, whatsapp: c.whatsapp ?? c.telefone,
        mensalidade: a?.valorMensal ?? 0, desde: a?.desde ?? null, mesesPagos: a?.mesesPagos ?? 0,
        pagoEsteMes: a?.pagoEsteMes ?? false, ativo: !!a,
        atraso: atraso?.valor ?? 0, diasAtraso: atraso ? diasEntre(atraso.maisAntigo, hoje) : 0, status: c.status,
      }
    })
    // Mensalidades lançadas sem cliente vinculado (identificadas pela descrição).
    for (const a of mrr.ativos) {
      if (clientes.some((c) => c.id === a.chave)) continue
      linhas.push({
        chave: a.chave, clienteId: a.chave.startsWith('d:') ? null : a.chave, nome: a.nome, empresa: null, whatsapp: a.whatsapp,
        mensalidade: a.valorMensal, desde: a.desde, mesesPagos: a.mesesPagos, pagoEsteMes: a.pagoEsteMes, ativo: true,
        atraso: 0, diasAtraso: 0, status: null,
      })
    }

    const emAtraso = linhas.filter((l) => l.atraso > 0)
    return {
      mrr, linhas,
      totalAtraso: emAtraso.reduce((s, l) => s + l.atraso, 0),
      contagem: {
        ativos: linhas.filter((l) => l.ativo).length,
        aguardando: linhas.filter((l) => l.ativo && !l.pagoEsteMes).length,
        atraso: emAtraso.length,
        sem_mensalidade: linhas.filter((l) => !l.ativo && l.status !== 'inativo').length,
        todos: linhas.length,
      },
      semCliente: linhas.filter((l) => !l.clienteId).length,
    }
  }, [clientes, lancamentos, recorrentes, hoje])

  const termo = busca.toLowerCase()
  const visiveis = calc.linhas
    .filter((l) => {
      if (aba === 'ativos') return l.ativo
      if (aba === 'aguardando') return l.ativo && !l.pagoEsteMes
      if (aba === 'atraso') return l.atraso > 0
      if (aba === 'sem_mensalidade') return !l.ativo && l.status !== 'inativo'
      return true
    })
    .filter((l) => !termo || [l.nome, l.empresa].some((v) => v?.toLowerCase().includes(termo)))
    .sort((a, b) => (aba === 'atraso' ? b.atraso - a.atraso : b.mensalidade - a.mensalidade || a.nome.localeCompare(b.nome)))

  const abas: { key: Aba; label: string }[] = [
    { key: 'ativos', label: 'Pagando' },
    { key: 'aguardando', label: 'Aguardando este mês' },
    { key: 'atraso', label: 'Em atraso' },
    { key: 'sem_mensalidade', label: 'Sem mensalidade' },
    { key: 'todos', label: 'Todos' },
  ]

  function exportar() {
    baixarCSV(
      `catalogo-place-${hoje}.csv`,
      ['Cliente', 'Empresa', 'Mensalidade', 'Desde', 'Meses pagos', 'Pago este mês', 'Em atraso'],
      visiveis.map((l) => [l.nome, l.empresa ?? '', l.mensalidade, mesLabel(l.desde), String(l.mesesPagos), l.pagoEsteMes ? 'Sim' : 'Não', l.atraso]),
    )
  }

  const mov = calc.mrr.mesAtual
  const passado = calc.mrr.mesPassado

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Catálogo Place" description="Assinantes e mensalidades" />

      <main className="flex-1 p-4 md:p-6">
        <PageHeader
          title="Catálogo Place"
          description="Assinantes são os clientes do tipo Catálogo Place. As mensalidades vêm dos lançamentos do financeiro."
        >
          <Button variant="outline" size="sm" asChild><Link href="/catalogo/asaas"><PlugZap className="h-4 w-4" /> Asaas</Link></Button>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!visiveis.length}><Download className="h-4 w-4" /> Exportar CSV</Button>
        </PageHeader>

        {erro && <p className="mb-4 text-sm text-brand-rosa">{erro}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard title="MRR" value={formatCurrency(calc.mrr.mrr)} icon={Repeat} iconColor="text-brand-lima" />
              <KpiCard title="Assinantes pagando" value={String(calc.contagem.ativos)} icon={Users} />
              <KpiCard title="Novos este mês" value={String(mov.novos)} icon={UserPlus} />
              <KpiCard title="Cancelaram mês passado" value={String(passado.churn)} icon={UserMinus} iconColor={passado.churn > 0 ? 'text-brand-rosa' : 'text-brand-lavanda/40'} />
              <KpiCard title="Em atraso" value={formatCurrency(calc.totalAtraso)} icon={AlertTriangle} iconColor={calc.totalAtraso > 0 ? 'text-brand-rosa' : 'text-brand-lavanda/40'} />
            </div>

            <div className="flex flex-wrap gap-2">
              {abas.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAba(key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    aba === key ? 'border-brand-lima bg-brand-lima/20 text-brand-lima' : 'border-white/[0.1] bg-white/[0.04] text-brand-lavanda/70 hover:text-brand-lavanda'
                  )}
                >
                  {label}<span className="rounded-full bg-white/[0.02] px-1.5">{calc.contagem[key]}</span>
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
              <Input className="pl-9" placeholder="Buscar assinante..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Assinante</th>
                        <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Mensalidade</th>
                        <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Desde</th>
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
                        const wa = !l.pagoEsteMes || l.atraso > 0 ? whatsappUrl(l.whatsapp, cobranca) : null
                        return (
                          <tr key={l.chave} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                            <td className="px-6 py-3">
                              {l.clienteId ? (
                                <Link href={`/clientes/${l.clienteId}`} className="font-medium text-brand-lavanda hover:text-brand-lima">{l.nome}</Link>
                              ) : (
                                <span className="font-medium text-brand-lavanda">{l.nome} <span className="text-[11px] font-normal text-yellow-400">sem cliente vinculado</span></span>
                              )}
                              {l.empresa && <p className="text-xs text-brand-lavanda/40">{l.empresa}</p>}
                            </td>
                            <td className="px-4 py-3 text-right text-brand-lavanda">{l.mensalidade ? formatCurrency(l.mensalidade) : '—'}</td>
                            <td className="px-4 py-3 text-xs text-brand-lavanda/60 whitespace-nowrap">
                              {mesLabel(l.desde)}{l.mesesPagos > 0 && <span className="text-brand-lavanda/40"> · {l.mesesPagos} {l.mesesPagos === 1 ? 'mês' : 'meses'}</span>}
                            </td>
                            <td className="px-4 py-3">
                              {!l.ativo ? (
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
                            <td className="px-4 py-3 text-right">
                              {wa && (
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> Cobrar</a>
                                </Button>
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

            <p className="text-[11px] text-brand-lavanda/40">
              Pagando = tem mensalidade lançada neste mês ou no anterior. &quot;Sem mensalidade&quot; = cliente do Catálogo sem mensalidade recente: pode ter cancelado ou faltar lançar.
              {calc.semCliente > 0 && ` ${calc.semCliente} assinante(s) aparecem só pela descrição do lançamento, sem cliente cadastrado; nos próximos lançamentos, escolha o cliente.`}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

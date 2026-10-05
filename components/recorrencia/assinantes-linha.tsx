'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Repeat, Users, UserPlus, UserMinus, AlertTriangle, Search, MessageCircle, Download, ChevronRight, Loader2 } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssinantePainel } from '@/components/catalogo/assinante-painel'
import { baixarCSV } from '@/lib/financeiro'
import { cicloLabel, formaLabel } from '@/lib/asaas/rotulos'
import { ativa, nomeLinha, type AbaLista, type Assinante, type LinhaRec } from '@/lib/recorrencia'
import { cn, formatCurrency, formatDate, whatsappUrl } from '@/lib/utils'
import type { Recorrencia } from '@/components/recorrencia/use-recorrencia'

type Ordem = 'vencimento' | 'nome' | 'nome_desc' | 'mensalidade_desc' | 'mensalidade' | 'atraso' | 'antigos' | 'recentes'

const ordens: { value: Ordem; label: string }[] = [
  { value: 'vencimento', label: 'Inadimplentes e próximo vencimento' },
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

const daLinha = (l: Assinante) => l.assinaturas.filter((s) => l.idsDaLinha.includes(s.id))
const assinaturaAtiva = (l: Assinante) => daLinha(l).find(ativa)
// Próxima cobrança da assinatura ativa desta linha (nulo = sem assinatura ativa no Asaas).
const proximaCobranca = (l: Assinante) => assinaturaAtiva(l)?.proximaCobranca ?? null

// Quem não tem o dado usado na ordenação vai para o fim da lista.
function comparar(a: Assinante, b: Assinante, ordem: Ordem): number {
  const vaziosNoFim = (x: string | null, y: string | null, sentido: 1 | -1) =>
    x && y ? x.localeCompare(y) * sentido : x ? -1 : y ? 1 : 0
  switch (ordem) {
    // Inadimplentes primeiro (mais dias em atraso no topo): o Asaas segue gerando cobranças
    // novas para eles, então a próxima cobrança sozinha os jogaria para o fim da lista.
    case 'vencimento':
      return Number(b.atraso > 0) - Number(a.atraso > 0)
        || (a.atraso > 0 && b.atraso > 0 ? b.diasAtraso - a.diasAtraso : 0)
        || vaziosNoFim(proximaCobranca(a), proximaCobranca(b), 1)
        || vaziosNoFim(a.ultimoPagamento, b.ultimoPagamento, -1)
    case 'nome': return a.nome.localeCompare(b.nome, 'pt-BR')
    case 'nome_desc': return b.nome.localeCompare(a.nome, 'pt-BR')
    case 'mensalidade_desc': return b.mensalidade - a.mensalidade
    case 'mensalidade': return (a.mensalidade || Infinity) - (b.mensalidade || Infinity) || 0
    case 'atraso': return b.atraso - a.atraso || b.diasAtraso - a.diasAtraso
    case 'antigos': return vaziosNoFim(a.desde, b.desde, 1)
    case 'recentes': return vaziosNoFim(a.desde, b.desde, -1)
  }
}

export function AssinantesLinha({ r, linha }: { r: Recorrencia; linha: LinhaRec }) {
  const calc = linha === 'catalogo_place' ? r.catalogo : r.servicos
  const produto = linha === 'catalogo_place' ? ' do Catálogo Place' : ''
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<AbaLista>('ativos')
  const [ordem, setOrdem] = useState<Ordem>('vencimento')
  const [aberto, setAberto] = useState<string | null>(null)

  const termo = busca.toLowerCase()
  const visiveis = calc.linhas
    .filter((l) => {
      if (aba === 'so_asaas') return l.soNoAsaas
      if (aba === 'todos') return true
      if (l.soNoAsaas) return false
      if (aba === 'ativos') return l.ativo
      if (aba === 'aguardando') return l.ativo && !l.pagoEsteMes
      if (aba === 'atraso') return l.atraso > 0
      if (aba === 'canceladas') return l.cancelada
      return !l.ativo && !l.cancelada && l.status !== 'inativo'
    })
    .filter((l) => !termo || [l.nome, l.empresa].some((v) => v?.toLowerCase().includes(termo)))
    .sort((a, b) => comparar(a, b, ordem) || a.nome.localeCompare(b.nome, 'pt-BR'))

  const abas: { key: AbaLista; label: string }[] = [
    { key: 'ativos', label: 'Ativas' },
    { key: 'aguardando', label: 'Aguardando este mês' },
    { key: 'atraso', label: 'Inadimplentes' },
    { key: 'canceladas', label: 'Canceladas' },
    { key: 'sem_mensalidade', label: 'Sem mensalidade' },
    ...(calc.contagem.so_asaas > 0 ? [{ key: 'so_asaas' as AbaLista, label: 'Só no Asaas' }] : []),
    { key: 'todos', label: 'Todos' },
  ]

  function exportar() {
    baixarCSV(
      `mrr-${linha === 'catalogo_place' ? 'catalogo-place' : 'servicos'}-${r.dados.hoje}.csv`,
      ['Cliente', 'Empresa', 'Mensalidade', 'Desde', 'Meses pagos', 'Pago este mês', 'Em atraso', 'Próxima cobrança (Asaas)'],
      visiveis.map((l) => {
        const s = assinaturaAtiva(l)
        return [l.nome, l.empresa ?? '', l.mensalidade, mesLabel(l.desde), String(l.mesesPagos), l.pagoEsteMes ? 'Sim' : 'Não', l.atraso, s ? formatDate(s.proximaCobranca) : '']
      }),
    )
  }

  const mov = calc.mrr.mesAtual
  const passado = calc.mrr.mesPassado
  const selecionado = calc.linhas.find((l) => l.chave === aberto) ?? null

  return (
    <div className="space-y-5">
      {calc.tipoErrado.length > 0 && (
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-4 py-2.5 text-sm text-brand-lavanda/80">
          <AlertTriangle className="mr-1.5 inline h-4 w-4 text-yellow-400" />
          {calc.tipoErrado.length === 1 ? 'Este cliente tem' : 'Estes clientes têm'} mensalidade do Catálogo, mas {calc.tipoErrado.length === 1 ? 'está cadastrado' : 'estão cadastrados'} só como Agência:{' '}
          {calc.tipoErrado.map((c, i) => (
            <span key={c.id}>{i > 0 && ', '}<Link href={`/clientes/${c.id}`} className="font-medium text-brand-lavanda hover:text-brand-lima">{c.nome.trim()}</Link></span>
          ))}
          . Mude o tipo para &quot;Agência + Catálogo&quot; no cadastro.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title={`MRR ${nomeLinha[linha]}`}
          value={formatCurrency(calc.mrrBruto)}
          icon={Repeat}
          iconColor="text-brand-lima"
          sub={r.asaasCarregando
            ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> buscando no Asaas…</span>
            : <span title={`Bruto: valor cobrado nas assinaturas ativas (${calc.viaAsaas} pelo Asaas, ${calc.viaFinanceiro} pelo financeiro). Líquido: mensalidades lançadas no financeiro, já sem as taxas do Asaas.`}>
                Bruto · líquido <span className="text-brand-lavanda/70">{formatCurrency(calc.mrr.mrr)}</span>
              </span>}
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
          <div className="relative flex-1 lg:w-56 lg:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
            <Input className="pl-9" placeholder="Buscar assinante..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
            <SelectTrigger className="w-auto min-w-44" aria-label="Ordenar por"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ordens.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={exportar} disabled={!visiveis.length} title="Exportar CSV" aria-label="Exportar CSV">
            <Download className="h-4 w-4" />
          </Button>
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
                    ? `Oi ${l.nome.split(' ')[0]}! Tudo bem? Identificamos ${formatCurrency(l.atraso)} em aberto da sua mensalidade${produto}. Consegue verificar?`
                    : `Oi ${l.nome.split(' ')[0]}! Passando para lembrar da mensalidade${produto} deste mês.`
                  const wa = !l.soNoAsaas && (!l.pagoEsteMes || l.atraso > 0) && l.ativo ? whatsappUrl(l.whatsapp, cobranca) : null
                  const sub = assinaturaAtiva(l)
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
                          {daLinha(l).length > 0 && !sub && <Badge variant="inativo">Assinatura cancelada</Badge>}
                        </div>
                        {l.empresa && l.empresa.trim() !== l.nome && <p className="text-xs text-brand-lavanda/40">{l.empresa}</p>}
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
                            <span className="text-brand-lavanda/80">{formatDate(sub.proximaCobranca)}</span>
                            {sub.vencidas > 0 && (
                              <span className="ml-1.5 text-[11px] text-brand-rosa">+ {sub.vencidas} vencida{sub.vencidas === 1 ? '' : 's'}</span>
                            )}
                            <span className="block text-[11px] text-brand-lavanda/40">{formaLabel[sub.formaPagamento] ?? sub.formaPagamento}</span>
                          </>
                        ) : l.cancelada ? (
                          <span className="text-brand-lavanda/40">
                            Cancelada
                            <span className="block text-[11px]">
                              {l.pagamentos} pagamento{l.pagamentos === 1 ? '' : 's'}{l.ultimoPagamento && ` · último ${formatDate(l.ultimoPagamento)}`}
                            </span>
                          </span>
                        ) : r.asaasCarregando && l.asaasCustomerId ? (
                          <Loader2 className="h-3 w-3 animate-spin text-brand-lavanda/30" />
                        ) : (
                          <span className="text-brand-lavanda/30">{r.asaasLigado && !l.asaasCustomerId && !l.soNoAsaas ? 'Fora do Asaas' : '—'}</span>
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
        MRR bruto = assinaturas ativas no Asaas (valor cobrado, planos não mensais convertidos para mensal); quem não está no Asaas entra pelo valor lançado no financeiro.
        MRR líquido = mensalidades lançadas no financeiro, já sem as taxas do Asaas.
        Ativas = tem assinatura ativa ou mensalidade lançada neste mês ou no anterior. Inadimplentes = tem mensalidade vencida e não paga. Canceladas = a assinatura foi cancelada no Asaas depois de ter tido pagamento.
        {linha === 'agencia' && ' Aqui entram só clientes com mensalidade de serviço (software, social…); projetos avulsos ficam de fora.'}
        {calc.semCliente > 0 && ` ${calc.semCliente} assinante(s) aparecem só pela descrição do lançamento, sem cliente cadastrado; nos próximos lançamentos, escolha o cliente.`}
      </p>

      <AssinantePainel
        assinante={selecionado}
        linha={linha}
        onClose={() => setAberto(null)}
        asaasConfigurado={r.asaasLigado}
        clientesSemAsaas={calc.clientesSemAsaas}
        customersSemCliente={calc.customersSemCliente}
        onAlterado={r.recarregarTudo}
      />
    </div>
  )
}

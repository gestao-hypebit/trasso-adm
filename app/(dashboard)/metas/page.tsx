'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Target, Pencil, Trash2, UserPlus, UserMinus,
  TrendingUp, TrendingDown, Trophy, Gauge, Megaphone, MessageSquareWarning, Check, X,
} from 'lucide-react'
import {
  Area, Bar, BarChart, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MovimentacaoDialog } from '@/components/metas/movimentacao-dialog'
import { DefinirMetasDialog } from '@/components/metas/definir-metas-dialog'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, formatDate, toISODateLocal } from '@/lib/utils'
import {
  FRENTES, COR_CANCELAMENTO, agrupar, corFrente, fimMes, inicioMes, labelCanal, labelFrente,
  mesAtual, nomeMes, resumirFrente, somarMeses,
  type Frente, type MetaMensal, type Movimentacao, type ResumoFrente, type TipoMov,
} from '@/lib/metas/calculos'

const MESES_HISTORICO = 6
const EIXO = { fill: 'rgba(245,242,255,0.45)', fontSize: 11 }

const RITMO_INFO = {
  adiantado: { label: 'Adiantado', cls: 'bg-brand-lima/10 text-brand-lima' },
  no_ritmo: { label: 'No ritmo', cls: 'bg-white/[0.06] text-brand-lavanda/80' },
  atrasado: { label: 'Atrasado', cls: 'bg-yellow-500/10 text-yellow-400' },
}

const fmtNum = (n: number, casas = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas })

export default function MetasPage() {
  const [mes, setMes] = useState(mesAtual)
  const [loading, setLoading] = useState(true)
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [metas, setMetas] = useState<MetaMensal[]>([])
  const [movOpen, setMovOpen] = useState(false)
  const [tipoInicial, setTipoInicial] = useState<TipoMov>('novo')
  const [editando, setEditando] = useState<Movimentacao | null>(null)
  const [metasOpen, setMetasOpen] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoMov>('todos')
  const [filtroFrente, setFiltroFrente] = useState<'todas' | Frente>('todas')
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)

  async function load() {
    const db = createClient() as any
    // Histórico precisa de MESES_HISTORICO meses + 1 (base do mais antigo).
    const desde = somarMeses(mes, -MESES_HISTORICO)
    const [{ data: m }, { data: mt }] = await Promise.all([
      db.from('metas_movimentacoes').select('*')
        .gte('data', inicioMes(desde)).lte('data', fimMes(mes))
        .order('data', { ascending: false }).order('created_at', { ascending: false }),
      db.from('metas_mensais').select('*')
        .gte('competencia', inicioMes(desde)).lte('competencia', inicioMes(mes)),
    ])
    setMovs(((m ?? []) as Movimentacao[]).map((x) => ({ ...x, valor: Number(x.valor) })))
    setMetas((mt ?? []) as MetaMensal[])
    setLoading(false)
  }

  useEffect(() => { setLoading(true); load() }, [mes]) // eslint-disable-line react-hooks/exhaustive-deps

  const resumos = useMemo(() => FRENTES.map((f) => resumirFrente(f.value, mes, movs, metas)), [mes, movs, metas])
  const temMetas = metas.some((m) => m.competencia.startsWith(mes))
  const doMes = useMemo(() => movs.filter((m) => m.data.startsWith(mes)), [movs, mes])
  const novosMes = doMes.filter((m) => m.tipo === 'novo')
  const cancMes = doMes.filter((m) => m.tipo === 'cancelamento')

  const totalNovos = novosMes.length
  const totalCanc = cancMes.length
  const cp = resumos.find((r) => r.frente === 'catalogo_place')!
  const mrrLiquido = cp.valorGanho - cp.valorPerdido

  const porCanal = agrupar(novosMes, (m) => m.canal ?? 'outro')
  const porMotivo = agrupar(cancMes, (m) => m.motivo?.trim() || 'Sem motivo informado')

  const historico = useMemo(() => Array.from({ length: MESES_HISTORICO }, (_, i) => {
    const m = somarMeses(mes, i - MESES_HISTORICO + 1)
    const linha: Record<string, string | number | null> = { mes: m, label: nomeMes(m, true) }
    FRENTES.forEach((f) => {
      const r = resumirFrente(f.value, m, movs, metas)
      linha[f.value] = r.meta > 0 ? Math.round(r.pct * 100) : null
      linha[`${f.value}_novos`] = r.novos
      linha[`${f.value}_meta`] = r.meta
    })
    return linha
  }), [mes, movs, metas])

  const realizadoAnterior = useMemo(() => {
    const ant = somarMeses(mes, -1)
    return Object.fromEntries(FRENTES.map((f) => [
      f.value, movs.filter((m) => m.frente === f.value && m.tipo === 'novo' && m.data.startsWith(ant)).length,
    ])) as Record<Frente, number>
  }, [mes, movs])

  const registros = doMes.filter((m) =>
    (filtroTipo === 'todos' || m.tipo === filtroTipo) && (filtroFrente === 'todas' || m.frente === filtroFrente))

  // Data sugerida: hoje, se estiver vendo o mês corrente; senão, último dia do mês visto.
  const dataPadrao = mes === mesAtual() ? toISODateLocal(new Date()) : fimMes(mes)
  const ehMesAtual = mes === mesAtual()
  const proximoMes = somarMeses(mesAtual(), 1)
  const fimDoMesChegando = ehMesAtual && new Date().getDate() >= diasRestantesAviso()

  function abrirNovo(tipo: TipoMov) {
    setEditando(null)
    setTipoInicial(tipo)
    setMovOpen(true)
  }

  async function excluir(id: string) {
    await (createClient() as any).from('metas_movimentacoes').delete().eq('id', id)
    setConfirmandoExclusao(null)
    load()
  }

  return (
    <div>
      <Header title="Metas" description="Aquisição de clientes e saúde da base" />
      <div className="p-6 space-y-6">
        <PageHeader title="Metas do mês" description="Registre cada cliente que entra ou sai — o resto é calculado sozinho.">
          <div className="flex items-center rounded-lg border border-white/[0.1] bg-white/[0.03]">
            <Button variant="ghost" size="icon" onClick={() => setMes(somarMeses(mes, -1))} title="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setMes(mesAtual())}
              className="min-w-36 px-2 text-sm font-semibold text-brand-lavanda"
              title="Voltar para o mês atual"
            >
              {nomeMes(mes)}
            </button>
            <Button variant="ghost" size="icon" onClick={() => setMes(somarMeses(mes, 1))} title="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => setMetasOpen(true)} className="gap-2">
            <Target className="h-4 w-4" /> {temMetas ? 'Editar metas' : 'Definir metas'}
          </Button>
          <Button onClick={() => abrirNovo('novo')} className="gap-2">
            <Plus className="h-4 w-4" /> Registrar
          </Button>
        </PageHeader>

        {/* Avisos */}
        {!loading && !temMetas && (
          <Card className="border-brand-lima/20 bg-brand-lima/[0.04]">
            <CardContent className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Target className="h-5 w-5 text-brand-lima shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand-lavanda">As metas de {nomeMes(mes)} ainda não foram definidas</p>
                <p className="text-xs text-brand-lavanda/50">Defina quantos clientes novos quer em cada frente para acompanhar o ritmo do mês.</p>
              </div>
              <Button onClick={() => setMetasOpen(true)} className="gap-2"><Target className="h-4 w-4" /> Definir metas</Button>
            </CardContent>
          </Card>
        )}
        {!loading && temMetas && fimDoMesChegando && !metas.some((m) => m.competencia.startsWith(proximoMes)) && (
          <button
            onClick={() => setMes(proximoMes)}
            className="w-full flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xs text-brand-lavanda/60 hover:text-brand-lavanda hover:bg-white/[0.04] transition-colors"
          >
            <Target className="h-3.5 w-3.5 text-brand-lima" />
            O mês está acabando — já quer definir as metas de <span className="font-semibold capitalize">{nomeMes(proximoMes)}</span>?
            <ChevronRight className="h-3.5 w-3.5 ml-auto" />
          </button>
        )}

        {/* Progresso por frente */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {resumos.map((r) => <CardFrente key={r.frente} r={r} mes={mes} loading={loading} />)}
        </div>

        {/* Saúde da base */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile icon={UserPlus} iconCls="text-brand-lima" titulo="Clientes novos" valor={loading ? '...' : String(totalNovos)}
            sub={resumos.map((r) => `${r.novos} ${labelFrente(r.frente)}`).join(' · ')} />
          <Tile icon={UserMinus} iconCls="text-brand-rosa" titulo="Cancelamentos" valor={loading ? '...' : String(totalCanc)}
            sub={resumos.map((r) => `${r.cancelamentos} ${labelFrente(r.frente)}`).join(' · ')} />
          <Tile icon={(totalNovos - totalCanc) >= 0 ? TrendingUp : TrendingDown}
            iconCls={(totalNovos - totalCanc) >= 0 ? 'text-brand-lima' : 'text-brand-rosa'}
            titulo="Saldo de clientes"
            valor={loading ? '...' : `${totalNovos - totalCanc > 0 ? '+' : ''}${totalNovos - totalCanc}`}
            sub="novos menos cancelamentos" />
          <Tile icon={Gauge} iconCls={mrrLiquido >= 0 ? 'text-brand-lima' : 'text-brand-rosa'}
            titulo="MRR líquido · Catálogo Place"
            valor={loading ? '...' : `${mrrLiquido > 0 ? '+' : ''}${formatCurrency(mrrLiquido)}`}
            sub={`+${formatCurrency(cp.valorGanho)} entrou · −${formatCurrency(cp.valorPerdido)} saiu`} />
        </div>

        {/* Canais e motivos */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4 text-brand-lavanda/40" /> De onde vieram os clientes</CardTitle>
            </CardHeader>
            <CardContent>
              {porCanal.length === 0 ? (
                <Vazio texto="Nenhum cliente novo registrado neste mês." />
              ) : (
                <div className="space-y-3">
                  {porCanal.map((c) => (
                    <BarraHorizontal key={c.chave} label={labelCanal(c.chave)} total={c.total} max={porCanal[0].total}
                      pct={c.total / totalNovos} cor="#8B5CF6" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><MessageSquareWarning className="h-4 w-4 text-brand-lavanda/40" /> Por que cancelaram</CardTitle>
            </CardHeader>
            <CardContent>
              {porMotivo.length === 0 ? (
                <Vazio texto="Nenhum cancelamento neste mês. 🎉" />
              ) : (
                <div className="space-y-3">
                  {porMotivo.map((c) => (
                    <BarraHorizontal key={c.chave} label={c.chave} total={c.total} max={porMotivo[0].total}
                      pct={c.total / totalCanc} cor={COR_CANCELAMENTO} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Histórico */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">% da meta atingido · últimos {MESES_HISTORICO} meses</CardTitle>
              <div className="flex items-center gap-4 text-xs text-brand-lavanda/60">
                {FRENTES.map((f) => (
                  <span key={f.value} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.cor }} />{f.label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5"><span className="h-0 w-3 border-t border-dashed border-brand-lavanda/50" />Meta (100%)</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[240px] flex items-center justify-center text-brand-lavanda/30 text-sm">Carregando...</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={historico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%" barGap={2}>
                  <CartesianGrid vertical={false} stroke="rgba(245,242,255,0.06)" />
                  <XAxis dataKey="label" tick={EIXO} axisLine={false} tickLine={false} />
                  <YAxis tick={EIXO} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<TooltipHistorico />} cursor={{ fill: 'rgba(245,242,255,0.04)' }} />
                  <ReferenceLine y={100} stroke="rgba(232,228,248,0.5)" strokeDasharray="4 4" />
                  {FRENTES.map((f) => (
                    <Bar key={f.value} dataKey={f.value} name={f.label} fill={f.cor} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Registro */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">Registro de clientes · {nomeMes(mes)}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Filtro ativo={filtroTipo === 'todos'} onClick={() => setFiltroTipo('todos')}>Todos ({doMes.length})</Filtro>
                <Filtro ativo={filtroTipo === 'novo'} onClick={() => setFiltroTipo('novo')}>Novos ({totalNovos})</Filtro>
                <Filtro ativo={filtroTipo === 'cancelamento'} onClick={() => setFiltroTipo('cancelamento')}>Cancelamentos ({totalCanc})</Filtro>
                <span className="mx-1 h-4 w-px bg-white/[0.1]" />
                <Filtro ativo={filtroFrente === 'todas'} onClick={() => setFiltroFrente('todas')}>Todas as frentes</Filtro>
                {FRENTES.map((f) => (
                  <Filtro key={f.value} ativo={filtroFrente === f.value} onClick={() => setFiltroFrente(f.value)}>
                    <span className="h-2 w-2 rounded-full" style={{ background: f.cor }} />{f.label}
                  </Filtro>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-brand-lavanda/40 py-10 text-center">Carregando...</p>
            ) : registros.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-sm text-brand-lavanda/50">Nenhuma movimentação {doMes.length ? 'com esses filtros' : 'registrada neste mês'}.</p>
                {!doMes.length && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => abrirNovo('novo')} className="gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Cliente novo</Button>
                    <Button size="sm" variant="outline" onClick={() => abrirNovo('cancelamento')} className="gap-1.5"><UserMinus className="h-3.5 w-3.5" /> Cancelamento</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs text-brand-lavanda/50">
                      <th className="text-left font-medium px-6 py-3">Data</th>
                      <th className="text-left font-medium px-3 py-3">Cliente</th>
                      <th className="text-left font-medium px-3 py-3">Frente</th>
                      <th className="text-left font-medium px-3 py-3">Tipo</th>
                      <th className="text-left font-medium px-3 py-3">Canal / Motivo</th>
                      <th className="text-right font-medium px-3 py-3">Valor</th>
                      <th className="px-4 py-3 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((m) => (
                      <tr key={m.id} className="group border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-6 py-3 text-brand-lavanda/60 whitespace-nowrap">{formatDate(m.data, 'dd/MM')}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-brand-lavanda">{m.cliente_nome}</p>
                          {m.observacoes && <p className="text-[11px] text-brand-lavanda/40 truncate max-w-xs">{m.observacoes}</p>}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="flex items-center gap-1.5 text-brand-lavanda/70">
                            <span className="h-2 w-2 rounded-full" style={{ background: corFrente(m.frente) }} />{labelFrente(m.frente)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {m.tipo === 'novo'
                            ? <span className="inline-flex items-center gap-1 rounded-md bg-brand-lima/10 px-2 py-0.5 text-[11px] font-medium text-brand-lima"><UserPlus className="h-3 w-3" /> Novo</span>
                            : <span className="inline-flex items-center gap-1 rounded-md bg-brand-rosa/10 px-2 py-0.5 text-[11px] font-medium text-brand-rosa"><UserMinus className="h-3 w-3" /> Cancelou</span>}
                        </td>
                        <td className="px-3 py-3 text-brand-lavanda/60">{m.tipo === 'novo' ? labelCanal(m.canal) : m.motivo || '—'}</td>
                        <td className={cn('px-3 py-3 text-right whitespace-nowrap', m.tipo === 'novo' ? 'text-brand-lavanda/80' : 'text-brand-lavanda/50')}>
                          {m.valor ? `${m.tipo === 'cancelamento' ? '−' : ''}${formatCurrency(m.valor)}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {confirmandoExclusao === m.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[11px] text-brand-rosa mr-1">Excluir?</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-brand-rosa" onClick={() => excluir(m.id)} title="Confirmar"><Check className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmandoExclusao(null)} title="Cancelar"><X className="h-3.5 w-3.5" /></Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar"
                                onClick={() => { setEditando(m); setMovOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-brand-rosa" title="Excluir"
                                onClick={() => setConfirmandoExclusao(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MovimentacaoDialog
        open={movOpen}
        onOpenChange={setMovOpen}
        editando={editando}
        dataPadrao={dataPadrao}
        tipoInicial={tipoInicial}
        onSalvo={load}
      />
      <DefinirMetasDialog
        open={metasOpen}
        onOpenChange={setMetasOpen}
        mes={mes}
        metas={metas}
        realizadoAnterior={realizadoAnterior}
        onSalvo={load}
      />
    </div>
  )
}

// Mostra o convite para definir o próximo mês nos últimos 5 dias.
function diasRestantesAviso() {
  const hoje = new Date()
  return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate() - 4
}

// ---------------------------------------------------------------
// Card de progresso de uma frente
// ---------------------------------------------------------------
function CardFrente({ r, mes, loading }: { r: ResumoFrente; mes: string; loading: boolean }) {
  const f = FRENTES.find((x) => x.value === r.frente)!
  const semMeta = r.meta === 0
  const bateu = !semMeta && r.novos >= r.meta
  const passado = mes < mesAtual()
  const futuro = mes > mesAtual()
  const pctBarra = Math.min(r.pct, 1) * 100
  const pctEsperado = r.esperadoHoje !== null && r.meta ? Math.min(r.esperadoHoje / r.meta, 1) * 100 : null

  let mensagem: React.ReactNode = null
  if (semMeta) mensagem = 'Sem meta definida para este mês.'
  else if (bateu) mensagem = <>Meta batida{r.novos > r.meta ? <> com <b className="text-brand-lavanda">{r.novos - r.meta}</b> a mais</> : ''}! 🎯</>
  else if (passado) mensagem = <>Fechou o mês em <b className="text-brand-lavanda">{Math.round(r.pct * 100)}%</b> da meta.</>
  else if (futuro) mensagem = 'O mês ainda não começou.'
  else if (r.porDiaNecessario !== null) {
    const porSemana = r.porDiaNecessario * 7
    mensagem = (
      <>
        Faltam <b className="text-brand-lavanda">{r.faltam}</b> em {r.diasRestantes} {r.diasRestantes === 1 ? 'dia' : 'dias'} —
        {' '}{r.porDiaNecessario >= 1
          ? <>cerca de <b className="text-brand-lavanda">{fmtNum(r.porDiaNecessario)}</b> por dia.</>
          : <>cerca de <b className="text-brand-lavanda">{fmtNum(porSemana)}</b> por semana.</>}
        {r.projecao !== null && <> No ritmo atual, você fecha o mês com <b className="text-brand-lavanda">~{r.projecao}</b>.</>}
      </>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="h-1" style={{ background: f.cor }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black text-brand-noite shrink-0" style={{ background: f.cor }}>
              {f.label.charAt(0)}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand-lavanda">{f.label}</h3>
              <p className="text-[11px] text-brand-lavanda/40">{f.descricao}</p>
            </div>
          </div>
          {bateu ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-lima/10 px-2 py-0.5 text-[11px] font-semibold text-brand-lima"><Trophy className="h-3 w-3" /> Meta batida</span>
          ) : r.ritmo && (
            <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', RITMO_INFO[r.ritmo].cls)}>{RITMO_INFO[r.ritmo].label}</span>
          )}
        </div>

        <div className="flex items-end justify-between gap-4 mb-3">
          <p className="font-bold text-brand-lavanda leading-none" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            <span className="text-5xl">{loading ? '–' : r.novos}</span>
            <span className="text-xl text-brand-lavanda/30"> / {semMeta ? '—' : r.meta}</span>
          </p>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {semMeta ? '—' : `${Math.round(r.pct * 100)}%`}
            </p>
            <p className="text-[11px] text-brand-lavanda/40">da meta</p>
          </div>
        </div>

        {/* Barra de progresso com marcador do ritmo ideal */}
        <div className="relative h-3 rounded-full bg-white/[0.06] mb-1">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctBarra}%`, background: f.cor }} />
          {pctEsperado !== null && !bateu && (
            <div className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-brand-lavanda/70" style={{ left: `${pctEsperado}%` }}
              title={`Hoje o ideal seria ter ${fmtNum(r.esperadoHoje ?? 0)}`} />
          )}
        </div>
        {pctEsperado !== null && !bateu && (
          <p className="text-[10px] text-brand-lavanda/40 mb-3" >
            <span className="inline-block h-2 w-0.5 bg-brand-lavanda/70 align-middle mr-1" /> onde você deveria estar hoje ({fmtNum(r.esperadoHoje ?? 0)})
          </p>
        )}

        <p className="text-xs text-brand-lavanda/60 leading-relaxed min-h-8 mt-3">{mensagem}</p>

        {/* Ritmo acumulado */}
        {!semMeta && !futuro && (
          <div className="mt-4 -mx-1">
            <ResponsiveContainer width="100%" height={110}>
              <ComposedChart data={r.serie} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${r.frente}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={f.cor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={f.cor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dia" tick={{ ...EIXO, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis hide domain={[0, Math.max(r.meta, r.novos)]} />
                <Tooltip content={<TooltipRitmo cor={f.cor} mes={mes} />} cursor={{ stroke: 'rgba(245,242,255,0.2)' }} />
                <Line dataKey="ideal" type="linear" stroke="rgba(232,228,248,0.45)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} />
                <Area dataKey="realizado" type="stepAfter" stroke={f.cor} strokeWidth={2} fill={`url(#grad-${r.frente})`}
                  dot={false} activeDot={{ r: 4, fill: f.cor, stroke: '#141318', strokeWidth: 2 }} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 px-1 text-[10px] text-brand-lavanda/40">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full" style={{ background: f.cor }} />Realizado acumulado</span>
              <span className="flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-brand-lavanda/50" />Ritmo ideal</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-4">
          <MiniStat label="Faltam" valor={semMeta ? '—' : String(r.faltam)} />
          <MiniStat
            label="vs. mês anterior"
            valor={r.crescimento === null ? '—' : `${r.crescimento >= 0 ? '+' : ''}${Math.round(r.crescimento * 100)}%`}
            hint={r.base !== null ? `meta ${r.meta} vs. ${r.base} realizados` : undefined}
          />
          <MiniStat label="Cancelamentos" valor={String(r.cancelamentos)} alerta={r.cancelamentos > 0} />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------
// Peças pequenas
// ---------------------------------------------------------------
function MiniStat({ label, valor, hint, alerta }: { label: string; valor: string; hint?: string; alerta?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2.5 text-center" title={hint}>
      <p className={cn('text-base font-bold', alerta ? 'text-brand-rosa' : 'text-brand-lavanda')} style={{ fontFamily: 'var(--font-space-grotesk)' }}>{valor}</p>
      <p className="text-[10px] text-brand-lavanda/40 mt-0.5">{label}</p>
    </div>
  )
}

function Tile({ icon: Icon, iconCls, titulo, valor, sub }: { icon: React.ElementType; iconCls: string; titulo: string; valor: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-brand-lavanda/40 mb-3">{titulo}</p>
          <Icon className={cn('h-4 w-4 shrink-0', iconCls)} />
        </div>
        <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{valor}</p>
        <p className="text-[11px] text-brand-lavanda/40 mt-1 truncate" title={sub}>{sub}</p>
      </CardContent>
    </Card>
  )
}

function BarraHorizontal({ label, total, max, pct, cor }: { label: string; total: number; max: number; pct: number; cor: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-brand-lavanda/80">{label}</span>
        <span className="text-brand-lavanda/50"><b className="text-brand-lavanda">{total}</b> · {Math.round(pct * 100)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.05]">
        <div className="h-full rounded-full" style={{ width: `${(total / max) * 100}%`, background: cor }} />
      </div>
    </div>
  )
}

function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
        ativo ? 'border-white/[0.2] bg-white/[0.08] text-brand-lavanda' : 'border-white/[0.08] text-brand-lavanda/50 hover:text-brand-lavanda/80',
      )}
    >
      {children}
    </button>
  )
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-brand-lavanda/40 py-6 text-center">{texto}</p>
}

function TooltipRitmo({ active, payload, cor, mes }: {
  active?: boolean; payload?: { payload: { dia: number; realizado: number | null; ideal: number } }[]; cor: string; mes: string
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-2.5 text-xs shadow-xl min-w-40">
      <p className="text-brand-lavanda font-semibold mb-1">{formatDate(`${mes}-${String(p.dia).padStart(2, '0')}`, "dd 'de' MMM")}</p>
      <div className="flex justify-between gap-4"><span className="flex items-center gap-1.5 text-brand-lavanda/60"><span className="h-2 w-2 rounded-sm" style={{ background: cor }} />Realizado</span><span className="text-brand-lavanda font-medium">{p.realizado ?? '—'}</span></div>
      <div className="flex justify-between gap-4"><span className="text-brand-lavanda/60">Ideal até aqui</span><span className="text-brand-lavanda font-medium">{fmtNum(p.ideal)}</span></div>
    </div>
  )
}

function TooltipHistorico({ active, payload }: { active?: boolean; payload?: { payload: Record<string, string | number | null> }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#141318] p-3 text-xs shadow-xl min-w-52">
      <p className="text-brand-lavanda font-semibold mb-2 capitalize">{nomeMes(String(p.mes))}</p>
      {FRENTES.map((f) => (
        <div key={f.value} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-brand-lavanda/60"><span className="h-2 w-2 rounded-sm" style={{ background: f.cor }} />{f.label}</span>
          <span className="text-brand-lavanda font-medium">
            {p[`${f.value}_meta`] ? `${p[`${f.value}_novos`]} de ${p[`${f.value}_meta`]} · ${p[f.value]}%` : `${p[`${f.value}_novos`]} (sem meta)`}
          </span>
        </div>
      ))}
    </div>
  )
}

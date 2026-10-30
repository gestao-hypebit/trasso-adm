'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Minus, Pencil, Flame, Trophy, CalendarCheck, BadgeCheck } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Carregando } from '@/components/ui/carregando'
import { MetaDiariaDialog } from '@/components/metas/meta-diaria-dialog'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import { diaSP, somarDias } from '@/lib/anuncios/regras'
import {
  DIAS_SEMANA, agruparFeito, resumirPeriodo, sequencia, taxaConversao, ultimosDias, valeNoDia,
  type CampoRegistro, type Feito, type MetaDiaria, type RegistroDiario,
} from '@/lib/metas/diarias'

// Histórico carregado de uma vez: cobre a sequência e a navegação para trás.
const DIAS_HISTORICO = 400
const DIAS_GRADE = 30
const ESPERA_SALVAR_MS = 500

const fmtNum = (n: number, casas = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
const fmtPct = (t: number | null) => (t === null ? '—' : `${fmtNum(t * 100)}%`)

function labelDias(dias: number[]) {
  const s = [...dias].sort().join(',')
  if (s === '0,1,2,3,4,5,6') return 'Todo dia'
  if (s === '1,2,3,4,5') return 'Seg a sex'
  if (s === '1,2,3,4,5,6') return 'Seg a sáb'
  return DIAS_SEMANA.filter((d) => dias.includes(d.value)).map((d) => d.label).join(', ')
}

export default function MetasDiariasPage() {
  const hoje = diaSP(new Date())
  const [dia, setDia] = useState(hoje)
  const [loading, setLoading] = useState(true)
  const [metas, setMetas] = useState<MetaDiaria[]>([])
  const [feito, setFeito] = useState<Feito>({})
  const [convertidos, setConvertidos] = useState<Feito>({})
  const [erro, setErro] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<MetaDiaria | null>(null)
  const [verArquivadas, setVerArquivadas] = useState(false)
  // Um timer por meta+dia: vários cliques seguidos viram um único salvamento.
  const pendentes = useRef<Record<string, { timer: ReturnType<typeof setTimeout>; salvar: () => void }>>({})

  async function load() {
    const db = createClient() as any
    const [{ data: m, error: e1 }, { data: r, error: e2 }] = await Promise.all([
      db.from('metas_diarias').select('*').order('ordem').order('created_at'),
      db.from('metas_diarias_registros').select('meta_id, data, quantidade, convertidos').gte('data', somarDias(hoje, -DIAS_HISTORICO)),
    ])
    setErro(e1?.message ?? e2?.message ?? null)
    setMetas((m ?? []) as MetaDiaria[])
    const registros = (r ?? []) as RegistroDiario[]
    setFeito(agruparFeito(registros))
    setConvertidos(agruparFeito(registros, 'convertidos'))
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Salva o que estiver pendente ao sair da página.
  useEffect(() => () => {
    Object.values(pendentes.current).forEach((p) => { clearTimeout(p.timer); p.salvar() })
  }, [])

  // O upsert só manda o campo alterado; o outro fica como está (ou 0 se a linha é nova).
  function definir(meta: MetaDiaria, campo: CampoRegistro, valor: number) {
    const quantidade = Math.max(0, Math.round(valor))
    const setCampo = campo === 'quantidade' ? setFeito : setConvertidos
    setCampo((f) => ({ ...f, [meta.id]: { ...f[meta.id], [dia]: quantidade } }))
    const chave = `${campo}:${meta.id}:${dia}`
    const diaSalvo = dia
    async function salvar() {
      delete pendentes.current[chave]
      const { error } = await (createClient() as any).from('metas_diarias_registros').upsert(
        { meta_id: meta.id, data: diaSalvo, [campo]: quantidade, updated_at: new Date().toISOString() },
        { onConflict: 'meta_id,data' },
      )
      setErro(error ? `Não foi possível salvar: ${error.message}` : null)
    }
    if (pendentes.current[chave]) clearTimeout(pendentes.current[chave].timer)
    pendentes.current[chave] = { timer: setTimeout(salvar, ESPERA_SALVAR_MS), salvar }
  }

  const ativas = metas.filter((m) => m.ativa)
  const arquivadas = metas.filter((m) => !m.ativa)
  const valemHoje = ativas.filter((m) => valeNoDia(m, dia))
  const batidasHoje = valemHoje.filter((m) => (feito[m.id]?.[dia] ?? 0) >= m.alvo).length
  const ehHoje = dia === hoje

  function abrir(meta: MetaDiaria | null) {
    setEditando(meta)
    setDialogOpen(true)
  }

  return (
    <div>
      <Header title="Metas diárias" description="Rotina de todo dia" />
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader title="Metas diárias" description="O que precisa ser feito todo dia — vá contando ao longo do dia.">
          <div className="flex items-center rounded-lg border border-white/[0.1] bg-white/[0.03]">
            <Button variant="ghost" size="icon" onClick={() => setDia(somarDias(dia, -1))} title="Dia anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button onClick={() => setDia(hoje)} className="min-w-36 px-2 text-sm font-semibold text-brand-lavanda capitalize" title="Voltar para hoje">
              {ehHoje ? 'Hoje' : formatDate(dia, "EEE, dd 'de' MMM")}
            </button>
            <Button variant="ghost" size="icon" onClick={() => setDia(somarDias(dia, 1))} disabled={ehHoje} title="Próximo dia">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => abrir(null)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova meta
          </Button>
        </PageHeader>

        {erro && <p className="rounded-lg bg-brand-rosa/10 px-3 py-2 text-xs text-brand-rosa">{erro}</p>}

        {loading ? <Carregando /> : ativas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <CalendarCheck className="h-8 w-8 text-brand-lavanda/30" />
              <p className="text-sm text-brand-lavanda/60">Nenhuma meta diária ainda. Crie a primeira — por exemplo, mandar mensagem para 40 pessoas.</p>
              <Button onClick={() => abrir(null)} className="gap-1.5"><Plus className="h-4 w-4" /> Nova meta</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {valemHoje.length > 0 && (
              <p className="text-sm text-brand-lavanda/60">
                {batidasHoje === valemHoje.length
                  ? <><b className="text-brand-lima">Tudo feito{ehHoje ? ' hoje' : ' neste dia'}!</b> 🎯</>
                  : <><b className="text-brand-lavanda">{batidasHoje}</b> de <b className="text-brand-lavanda">{valemHoje.length}</b> {valemHoje.length === 1 ? 'meta batida' : 'metas batidas'}{ehHoje ? ' hoje' : ' neste dia'}.</>}
              </p>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {ativas.map((m) => (
                <CardMeta key={m.id} meta={m} dia={dia} hoje={hoje} feito={feito[m.id] ?? {}} convertidos={convertidos[m.id] ?? {}}
                  onDefinir={(campo, v) => definir(m, campo, v)} onEditar={() => abrir(m)} onVerDia={setDia} />
              ))}
            </div>
          </>
        )}

        {arquivadas.length > 0 && (
          <div>
            <button onClick={() => setVerArquivadas((v) => !v)} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda/70">
              {verArquivadas ? 'Esconder' : 'Ver'} metas arquivadas ({arquivadas.length})
            </button>
            {verArquivadas && (
              <div className="mt-3 grid gap-4 lg:grid-cols-2 opacity-60">
                {arquivadas.map((m) => (
                  <CardMeta key={m.id} meta={m} dia={dia} hoje={hoje} feito={feito[m.id] ?? {}} convertidos={convertidos[m.id] ?? {}}
                    onDefinir={(campo, v) => definir(m, campo, v)} onEditar={() => abrir(m)} onVerDia={setDia} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <MetaDiariaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        meta={editando}
        proximaOrdem={metas.length}
        onSalvo={load}
      />
    </div>
  )
}

// ---------------------------------------------------------------
// Card de uma meta: contador do dia, sequência e últimos 30 dias
// ---------------------------------------------------------------
function CardMeta({ meta, dia, hoje, feito, convertidos, onDefinir, onEditar, onVerDia }: {
  meta: MetaDiaria
  dia: string
  hoje: string
  feito: Record<string, number>
  convertidos: Record<string, number>
  onDefinir: (campo: CampoRegistro, valor: number) => void
  onEditar: () => void
  onVerDia: (dia: string) => void
}) {
  const qtd = feito[dia] ?? 0
  const vale = valeNoDia(meta, dia)
  const bateu = qtd >= meta.alvo
  const faltam = Math.max(meta.alvo - qtd, 0)
  const pct = Math.min(qtd / meta.alvo, 1) * 100
  const seq = sequencia(meta, feito, hoje)
  const grade = useMemo(() => ultimosDias(DIAS_GRADE, hoje), [hoje])
  const periodo = resumirPeriodo(meta, feito, grade)
  const conv = convertidos[dia] ?? 0
  const convPeriodo = grade.reduce((s, d) => s + (convertidos[d] ?? 0), 0)
  const [digitando, setDigitando] = useState<string | null>(null)

  function confirmarDigitado() {
    if (digitando !== null && digitando !== '') onDefinir('quantidade', Number(digitando) || 0)
    setDigitando(null)
  }

  return (
    <Card className="overflow-hidden">
      <div className="h-1" style={{ background: meta.cor }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-brand-lavanda truncate">{meta.titulo}</h3>
            <p className="text-[11px] text-brand-lavanda/40">{meta.alvo} {meta.unidade} · {labelDias(meta.dias_semana)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {seq > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-yellow-500/10 px-2 py-0.5 text-[11px] font-semibold text-yellow-400"
                title={`${seq} ${seq === 1 ? 'dia seguido' : 'dias seguidos'} batendo a meta`}>
                <Flame className="h-3 w-3" /> {seq}
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEditar} title="Editar meta">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-end justify-between gap-4 mb-3">
          {digitando !== null ? (
            <input
              autoFocus type="number" min={0} value={digitando}
              onChange={(e) => setDigitando(e.target.value)}
              onBlur={confirmarDigitado}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmarDigitado(); if (e.key === 'Escape') setDigitando(null) }}
              className="w-32 rounded-lg border border-white/[0.15] bg-white/[0.04] px-2 text-5xl font-bold text-brand-lavanda outline-none"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            />
          ) : (
            <button onClick={() => setDigitando(String(qtd))} title="Clique para digitar o número"
              className="text-left font-bold text-brand-lavanda leading-none" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              <span className="text-5xl">{qtd}</span>
              <span className="text-xl text-brand-lavanda/30"> / {meta.alvo}</span>
            </button>
          )}
          <div className="text-right">
            {bateu ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-lima/10 px-2 py-0.5 text-[11px] font-semibold text-brand-lima">
                <Trophy className="h-3 w-3" /> Meta batida
              </span>
            ) : (
              <>
                <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{faltam}</p>
                <p className="text-[11px] text-brand-lavanda/40">{vale ? 'faltam' : 'folga neste dia'}</p>
              </>
            )}
          </div>
        </div>

        <div className="h-3 rounded-full bg-white/[0.06] mb-4">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: meta.cor }} />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" onClick={() => onDefinir('quantidade', qtd - 1)} disabled={qtd === 0} title="Tirar 1">
            <Minus className="h-4 w-4" />
          </Button>
          <Button className="h-12 flex-1 gap-1.5 text-base font-semibold" onClick={() => onDefinir('quantidade', qtd + 1)}>
            <Plus className="h-5 w-5" /> 1
          </Button>
          <Button variant="outline" className="h-12 shrink-0 px-4" onClick={() => onDefinir('quantidade', qtd + 5)} title="Somar 5">
            +5
          </Button>
        </div>

        {meta.mede_conversao && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <BadgeCheck className="h-4 w-4 shrink-0 text-brand-lima" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-brand-lavanda/60">Converteram</p>
              <p className="text-[11px] text-brand-lavanda/40">
                {conv > qtd ? 'Mais do que contatos neste dia' : <>Taxa no dia: <b className="text-brand-lavanda">{fmtPct(taxaConversao(conv, qtd))}</b></>}
              </p>
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => onDefinir('convertidos', conv - 1)} disabled={conv === 0} title="Tirar 1 convertido">
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-8 text-center text-xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{conv}</span>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => onDefinir('convertidos', conv + 1)} title="Somar 1 convertido">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Últimos 30 dias: cada quadrado é um dia, mais forte quanto mais perto do alvo */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] text-brand-lavanda/40 mb-2">
            <span>Últimos {DIAS_GRADE} dias</span>
            <span>
              Batida em <b className="text-brand-lavanda">{periodo.batidos}</b> de {periodo.validos} dias
              {periodo.media !== null && <> · média <b className="text-brand-lavanda">{fmtNum(periodo.media)}</b>/dia</>}
            </span>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${DIAS_GRADE}, minmax(0, 1fr))` }}>
            {grade.map((d) => {
              const q = feito[d] ?? 0
              const valeDia = valeNoDia(meta, d)
              const frac = Math.min(q / meta.alvo, 1)
              return (
                <button
                  key={d} onClick={() => onVerDia(d)}
                  title={`${formatDate(d, "EEE, dd/MM")}: ${q} de ${meta.alvo}${meta.mede_conversao && convertidos[d] ? ` · ${convertidos[d]} converteram` : ''}${valeDia ? '' : ' (folga)'}`}
                  className={cn(
                    'aspect-square rounded-[3px] transition-transform hover:scale-125',
                    d === dia && 'ring-1 ring-brand-lavanda ring-offset-1 ring-offset-[#141318]',
                    !valeDia && q === 0 && 'opacity-30',
                  )}
                  style={{
                    background: q === 0
                      ? 'rgba(255,255,255,0.06)'
                      : `color-mix(in srgb, ${meta.cor} ${Math.round(30 + frac * 70)}%, transparent)`,
                  }}
                />
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-brand-lavanda/40">
            Total no período: <b className="text-brand-lavanda">{periodo.total}</b> {meta.unidade}
            {meta.mede_conversao && <> · <b className="text-brand-lavanda">{convPeriodo}</b> {convPeriodo === 1 ? 'convertido' : 'convertidos'} ({fmtPct(taxaConversao(convPeriodo, periodo.total))})</>}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

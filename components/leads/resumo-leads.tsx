'use client'

import { CalendarCheck, FileText, Inbox, Target, Timer, Wallet } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { formatCurrency } from '@/lib/utils'
import { etapaMaxima, ETAPAS_FUNIL, taxa, type Historico } from '@/lib/leads/funil'
import { temperaturaDoLead } from '@/lib/leads/trafego'
import { variacao } from '@/lib/leads/periodo'
import type { Lead } from '@/components/leads/lead-detalhe-dialog'

const I_REUNIAO = ETAPAS_FUNIL.indexOf('qualificado')
const I_PROPOSTA = ETAPAS_FUNIL.indexOf('proposta')
const FECHADAS = ['convertido', 'descartado']

const mediana = (xs: number[]) => {
  if (!xs.length) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

function fmtDuracao(ms: number | null) {
  if (ms === null) return '—'
  const min = ms / 60_000
  if (min < 60) return `${Math.max(1, Math.round(min))} min`
  const h = min / 60
  if (h < 48) return `${Math.round(h)}h`
  return `${Math.round(h / 24)} dias`
}

// Cards do topo da tela de leads. Tudo é sobre os leads que chegaram no período escolhido.
export function ResumoLeads({ leads, anteriores, historico, primeiroContato, toques, comparar }: {
  leads: Lead[]
  anteriores: Lead[]
  historico: Map<string, Historico[]>
  primeiroContato: Map<string, string>
  toques: Map<string, number>
  comparar: boolean
}) {
  const max = (l: Lead) => etapaMaxima(l, historico.get(l.id) ?? [])
  // Do site = chegou por um formulário (site ou landing); o resto foi cadastrado à mão.
  const doSite = leads.filter((l) => l.formulario_id).length
  const reunioes = leads.filter((l) => max(l) >= I_REUNIAO).length
  const propostas = leads.filter((l) => max(l) >= I_PROPOSTA).length
  const fechados = leads.filter((l) => l.status === 'convertido')
  const valorFechado = fechados.reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0)
  const abertos = leads.filter((l) => !FECHADAS.includes(l.status))
  const valorAberto = abertos.reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0)
  const quentes = abertos.filter((l) => temperaturaDoLead(l) === 'quente').length
  const semContato = leads.filter((l) => l.status === 'novo' && !toques.get(l.id)).length

  const tempos = leads.flatMap((l) => {
    const primeiro = primeiroContato.get(l.id)
    const ms = primeiro ? new Date(primeiro).getTime() - new Date(l.created_at).getTime() : -1
    return ms >= 0 ? [ms] : []
  })

  const compara = (atual: number, antes: number) => {
    const v = comparar ? variacao(atual, antes) : null
    return v === null ? {} : { change: v, changeLabel: 'vs período anterior' }
  }

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        title="Leads"
        value={String(leads.length)}
        icon={Inbox}
        iconColor="text-brand-rosa"
        sub={`${doSite} do site · ${leads.length - doSite} cadastrados`}
        {...compara(leads.length, anteriores.length)}
      />
      <KpiCard
        title="1º contato (mediana)"
        value={fmtDuracao(mediana(tempos))}
        icon={Timer}
        iconColor="text-yellow-400"
        sub={semContato ? <span className="text-brand-rosa">{semContato} novos sem contato</span> : 'Todos já contatados'}
      />
      <KpiCard
        title="Chegaram à reunião"
        value={String(reunioes)}
        icon={CalendarCheck}
        iconColor="text-brand-violeta"
        sub={`${taxa(reunioes, leads.length)}% dos leads`}
      />
      <KpiCard
        title="Propostas"
        value={String(propostas)}
        icon={FileText}
        iconColor="text-brand-lavanda/60"
        sub={`${taxa(propostas, reunioes)}% das reuniões`}
      />
      <KpiCard
        title="Fechados"
        value={String(fechados.length)}
        icon={Target}
        iconColor="text-brand-lima"
        sub={`${formatCurrency(valorFechado)} · ${taxa(fechados.length, leads.length)}% conversão`}
        {...compara(fechados.length, anteriores.filter((l) => l.status === 'convertido').length)}
      />
      <KpiCard
        title="No funil agora"
        value={formatCurrency(valorAberto)}
        icon={Wallet}
        iconColor="text-brand-lima"
        sub={`${abertos.length} em aberto · ${quentes} quentes`}
      />
    </div>
  )
}

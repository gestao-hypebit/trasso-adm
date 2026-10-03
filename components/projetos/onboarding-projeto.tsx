'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Plus, Trash2, Loader2, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PortalLinkAcoes, type ClientePortal } from '@/components/projetos/portal-link-acoes'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import { criarOnboarding, type Briefing, type OnboardingItem } from '@/lib/projetos/onboarding'

export function OnboardingProjeto({ projetoId, tipo, cliente }: { projetoId: string; tipo: string | null; cliente: ClientePortal | null }) {
  const [itens, setItens] = useState<OnboardingItem[]>([])
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState({ titulo: '', responsavel: 'cliente' as 'cliente' | 'agencia' })

  async function carregar() {
    const supabase = createClient() as any
    const [{ data: i, error }, { data: b }] = await Promise.all([
      supabase.from('onboarding_itens').select('*').eq('projeto_id', projetoId).order('ordem'),
      supabase.from('briefings').select('*').eq('projeto_id', projetoId).maybeSingle(),
    ])
    if (error) setErro('Não foi possível carregar. A migration de onboarding já foi aplicada no Supabase?')
    setItens((i as OnboardingItem[]) ?? [])
    setBriefing(b as Briefing | null)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [projetoId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function iniciar() {
    setIniciando(true)
    setErro(null)
    try {
      await criarOnboarding(createClient(), projetoId, tipo)
      await carregar()
    } catch {
      setErro('Não foi possível iniciar o onboarding.')
    }
    setIniciando(false)
  }

  async function alternar(item: OnboardingItem) {
    const concluido = !item.concluido
    const campos = { concluido, concluido_em: concluido ? new Date().toISOString() : null, concluido_por: concluido ? 'agencia' as const : null }
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...campos } : i)))
    const { error } = await (createClient() as any).from('onboarding_itens').update(campos).eq('id', item.id)
    if (error) setItens((prev) => prev.map((i) => (i.id === item.id ? item : i)))
  }

  async function adicionar() {
    if (!novo.titulo.trim()) return
    const { data, error } = await (createClient() as any)
      .from('onboarding_itens')
      .insert({ projeto_id: projetoId, titulo: novo.titulo.trim(), responsavel: novo.responsavel, ordem: itens.length })
      .select('*')
      .single()
    if (!error && data) {
      setItens((prev) => [...prev, data as OnboardingItem])
      setNovo((n) => ({ ...n, titulo: '' }))
    }
  }

  async function remover(id: string) {
    setItens((prev) => prev.filter((i) => i.id !== id))
    await (createClient() as any).from('onboarding_itens').delete().eq('id', id)
  }

  if (loading) return <p className="py-10 text-center text-sm text-brand-lavanda/40">Carregando...</p>

  if (itens.length === 0 && !briefing) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ClipboardList className="h-10 w-10 text-brand-lavanda/20 mx-auto mb-3" />
          <p className="text-sm text-brand-lavanda/70">Este projeto ainda não tem onboarding.</p>
          <p className="text-xs text-brand-lavanda/40 mt-1 mb-4">Cria o checklist e o briefing a partir do modelo do tipo de projeto. Dá para editar depois.</p>
          <Button onClick={iniciar} disabled={iniciando}>
            {iniciando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Iniciar onboarding'}
          </Button>
          {erro && <p className="mt-3 text-xs text-brand-rosa">{erro}</p>}
        </CardContent>
      </Card>
    )
  }

  const feitos = itens.filter((i) => i.concluido).length
  const progresso = itens.length ? Math.round((feitos / itens.length) * 100) : 0
  const grupos = [
    { key: 'cliente' as const, titulo: 'Com o cliente', ajuda: 'Aparece no portal; o cliente marca quando fizer.' },
    { key: 'agencia' as const, titulo: 'Com a agência', ajuda: 'O cliente vê o andamento, mas só a agência marca.' },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 max-w-md">
            <div className="flex justify-between text-xs text-brand-lavanda/50 mb-1.5">
              <span>Onboarding</span>
              <span className="font-semibold text-brand-lavanda">{feitos}/{itens.length} itens</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-brand-lima transition-all" style={{ width: `${progresso}%` }} />
            </div>
          </div>
          <PortalLinkAcoes cliente={cliente} mensagem="Para começarmos seu projeto, preciso que você responda o briefing e confira o checklist no seu portal:" />
        </CardContent>
      </Card>

      {erro && <p className="text-xs text-brand-rosa">{erro}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {grupos.map((g) => (
          <Card key={g.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{g.titulo}</CardTitle>
              <p className="text-xs text-brand-lavanda/40">{g.ajuda}</p>
            </CardHeader>
            <CardContent className="space-y-1">
              {itens.filter((i) => i.responsavel === g.key).map((item) => (
                <div key={item.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                  <button onClick={() => alternar(item)} className="mt-0.5 shrink-0" aria-label={item.concluido ? 'Desmarcar' : 'Marcar como feito'}>
                    {item.concluido ? <CheckCircle2 className="h-4 w-4 text-brand-lima" /> : <Circle className="h-4 w-4 text-brand-lavanda/30" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', item.concluido ? 'text-brand-lavanda/40 line-through' : 'text-brand-lavanda')}>{item.titulo}</p>
                    {item.descricao && <p className="text-xs text-brand-lavanda/40">{item.descricao}</p>}
                    {item.concluido && item.concluido_em && (
                      <p className="text-[11px] text-brand-lavanda/30">
                        Feito {item.concluido_por === 'cliente' ? 'pelo cliente' : ''} em {formatDate(item.concluido_em)}
                      </p>
                    )}
                  </div>
                  <button onClick={() => remover(item.id)} className="opacity-0 group-hover:opacity-100 text-brand-lavanda/30 hover:text-brand-rosa" aria-label="Remover item">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Novo item do checklist"
          value={novo.titulo}
          onChange={(e) => setNovo((n) => ({ ...n, titulo: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        />
        <Select value={novo.responsavel} onValueChange={(v) => setNovo((n) => ({ ...n, responsavel: v as 'cliente' | 'agencia' }))}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cliente">Com o cliente</SelectItem>
            <SelectItem value="agencia">Com a agência</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={adicionar} disabled={!novo.titulo.trim()}><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>

      {briefing && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Briefing</CardTitle>
            {briefing.status === 'respondido'
              ? <Badge variant="aprovada">Respondido em {formatDate(briefing.respondido_em)}</Badge>
              : <Badge variant="pendente">Aguardando o cliente</Badge>}
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              {briefing.perguntas.map((p) => {
                const resposta = briefing.respostas?.[p.chave]
                return (
                  <div key={p.chave}>
                    <dt className="text-xs font-medium text-brand-lavanda/50">{p.rotulo}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-brand-lavanda">
                      {resposta
                        ? p.tipo === 'link' ? <a href={resposta} target="_blank" rel="noreferrer" className="text-brand-lima underline break-all">{resposta}</a> : resposta
                        : <span className="text-brand-lavanda/30">—</span>}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

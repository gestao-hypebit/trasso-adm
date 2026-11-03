'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, KeyRound, Copy, Check, Save, Inbox, Loader2, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Carregando } from '@/components/ui/carregando'
import { EstadoVazio } from '@/components/ui/estado-vazio'
import { useAviso } from '@/components/ui/toaster'
import { SiteLeadsLista } from '@/components/sites-clientes/site-leads-lista'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { gerarChave, hashChave, prefixoVisivel } from '@/lib/sites-clientes/chave'
import { SITE_LEAD_SELECT, SITE_SELECT, type SiteCliente, type SiteLead, type SiteLeadStatus } from '@/lib/sites-clientes/leads'

type Site = SiteCliente & { clientes: { id: string; nome: string; empresa: string | null } | null }

export default function SiteClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const aviso = useAviso()
  const [site, setSite] = useState<Site | null>(null)
  const [leads, setLeads] = useState<SiteLead[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nome: '', dominio: '', repositorio: '', observacoes: '' })
  const [salvando, setSalvando] = useState(false)
  const [chaveNova, setChaveNova] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    async function load() {
      const db = createClient() as any
      const [{ data: s }, { data: l }] = await Promise.all([
        db.from('sites_clientes').select(`${SITE_SELECT}, clientes(id, nome, empresa)`).eq('id', id).maybeSingle(),
        db.from('site_leads').select(SITE_LEAD_SELECT).eq('site_id', id).order('created_at', { ascending: false }).limit(500),
      ])
      if (s) {
        setSite(s as Site)
        setForm({ nome: s.nome ?? '', dominio: s.dominio ?? '', repositorio: s.repositorio ?? '', observacoes: s.observacoes ?? '' })
      }
      setLeads((l as SiteLead[]) ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    const dados = {
      nome: form.nome.trim(),
      dominio: form.dominio.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || null,
      repositorio: form.repositorio.trim() || null,
      observacoes: form.observacoes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await (createClient() as any).from('sites_clientes').update(dados).eq('id', id)
    setSalvando(false)
    if (error) return aviso('Não foi possível salvar.', { tipo: 'erro' })
    setSite((s) => (s ? { ...s, ...dados } : s))
    aviso('Site salvo.')
  }

  async function alternarAtivo() {
    if (!site) return
    const ativo = !site.ativo
    const { error } = await (createClient() as any).from('sites_clientes').update({ ativo, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return aviso('Não foi possível alterar.', { tipo: 'erro' })
    setSite({ ...site, ativo })
    aviso(ativo ? 'Site reativado: os leads voltam a ser recebidos.' : 'Site desativado: a API passa a recusar os leads.')
  }

  async function novaChave() {
    if (!site) return
    if (site.chave_prefixo && !window.confirm('Gerar uma nova chave desliga a atual. O site só volta a enviar leads depois que você trocar a variável SLICK_SITE_KEY nele. Continuar?')) return
    setGerando(true)
    const chave = gerarChave()
    const agora = new Date().toISOString()
    const dados = { chave_hash: await hashChave(chave), chave_prefixo: prefixoVisivel(chave), chave_criada_em: agora, updated_at: agora }
    const { error } = await (createClient() as any).from('sites_clientes').update(dados).eq('id', id)
    setGerando(false)
    if (error) return aviso('Não foi possível gerar a chave.', { tipo: 'erro' })
    setSite({ ...site, ...dados })
    setChaveNova(chave)
    setCopiado(false)
  }

  async function copiar(texto: string) {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function mudarStatus(leadId: string, status: SiteLeadStatus) {
    const anterior = leads
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, status } : l)))
    const { error } = await (createClient() as any).from('site_leads').update({ status, updated_at: new Date().toISOString() }).eq('id', leadId)
    if (error) {
      setLeads(anterior)
      aviso('Não foi possível alterar o status.', { tipo: 'erro' })
    }
  }

  if (loading) return <Carregando />
  if (!site) {
    return (
      <div className="p-6">
        <EstadoVazio titulo="Site não encontrado" acao={{ label: 'Voltar para sites', href: '/sites-clientes' }} />
      </div>
    )
  }

  const origem = typeof window !== 'undefined' ? window.location.origin : ''
  const novos = leads.filter((l) => l.status === 'novo').length

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={site.nome} description={site.clientes?.empresa || site.clientes?.nome || 'Site do cliente'} />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/sites-clientes" className="flex items-center gap-1.5 text-sm text-brand-lavanda/50 hover:text-brand-lavanda">
            <ArrowLeft className="h-4 w-4" /> Sites
          </Link>
          <Badge variant={site.ativo ? 'ativo' : 'inativo'}>{site.ativo ? 'No ar' : 'Desativado'}</Badge>
          {site.clientes && (
            <Link href={`/clientes/${site.clientes.id}`} className="text-xs text-brand-lavanda/50 underline-offset-4 hover:text-brand-lavanda hover:underline">
              Ver cliente
            </Link>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Leads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Inbox className="h-4 w-4 text-brand-lavanda/40" /> Leads
                <span className="text-sm font-normal text-brand-lavanda/40">{leads.length}{novos > 0 && <span className="text-brand-lima"> · {novos} novos</span>}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <EstadoVazio titulo="Nenhum lead ainda" texto="Assim que o formulário do site enviar o primeiro contato, ele aparece aqui e no portal do cliente." />
              ) : (
                <SiteLeadsLista leads={leads} onMudarStatus={mudarStatus} />
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Chave */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-brand-lavanda/40" /> Chave do site</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {chaveNova ? (
                  <div className="space-y-2 rounded-lg border border-brand-lima/30 bg-brand-lima/[0.05] p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-brand-lima">
                      <AlertTriangle className="h-3.5 w-3.5" /> Copie agora: ela não aparece de novo.
                    </p>
                    <p className="break-all font-mono text-xs text-brand-lavanda">{chaveNova}</p>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => copiar(chaveNova)}>
                      {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiado ? 'Copiado' : 'Copiar chave'}
                    </Button>
                  </div>
                ) : site.chave_prefixo ? (
                  <p className="text-sm text-brand-lavanda/70">
                    <span className="font-mono">{site.chave_prefixo}…</span>
                    <span className="block text-xs text-brand-lavanda/40">gerada em {formatDate(site.chave_criada_em, 'dd/MM/yyyy HH:mm')}</span>
                  </p>
                ) : (
                  <p className="text-sm text-yellow-400">Sem chave: o site ainda não consegue enviar leads.</p>
                )}
                <Button size="sm" variant={site.chave_prefixo ? 'outline' : 'default'} onClick={novaChave} disabled={gerando}>
                  {gerando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {site.chave_prefixo ? 'Gerar nova chave' : 'Gerar chave'}
                </Button>

                <div className="space-y-1.5 border-t border-white/[0.06] pt-3 text-xs text-brand-lavanda/50">
                  <p>No projeto do site (variáveis de ambiente na Vercel):</p>
                  <pre className="overflow-x-auto rounded-md bg-black/30 p-2.5 font-mono text-[11px] text-brand-lavanda/80">{`SLICK_API_URL=${origem}\nSLICK_SITE_KEY=${chaveNova ?? 'slk_...'}`}</pre>
                  <p>O envio é feito pelo servidor do site (server action), nunca pelo navegador. Veja <span className="font-mono">docs/sites-clientes.md</span>.</p>
                </div>
              </CardContent>
            </Card>

            {/* Dados */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados do site</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Domínio</Label>
                  <Input value={form.dominio} onChange={(e) => setForm({ ...form, dominio: e.target.value })} placeholder="performei.com.br" />
                </div>
                <div className="space-y-1.5">
                  <Label>Repositório</Label>
                  <Input value={form.repositorio} onChange={(e) => setForm({ ...form, repositorio: e.target.value })} placeholder="github.com/slick/performei" />
                </div>
                <div className="space-y-1.5">
                  <Label>Anotações</Label>
                  <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={salvar} disabled={salvando || !form.nome.trim()} className="gap-2">
                    {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
                  </Button>
                  <Button size="sm" variant={site.ativo ? 'destructive' : 'outline'} onClick={alternarAtivo}>
                    {site.ativo ? 'Desativar site' : 'Reativar site'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

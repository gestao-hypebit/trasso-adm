'use client'

import { useEffect, useState } from 'react'
import { Copy, KeyRound, Loader2, RefreshCw } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AnunciosSubNav } from '@/components/anuncios/anuncios-sub-nav'
import { EditorFunil } from '@/components/anuncios/editor-funil'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COLUNAS_MARCA, type Marca } from '@/components/anuncios/use-anuncios'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, formatRelative } from '@/lib/utils'

type Conta = { id: string; plataforma: string; account_id: string; nome: string; historico_desde: string | null; backfill_concluido_em: string | null; ultima_sync_em: string | null }
type Pixel = { pixel_id: string; nome: string; marca_id: string | null; ultimo_disparo: string | null; historico_desde: string | null; erro: string | null }
type Sync = { id: string; conta_id: string; gatilho: string; status: string; periodo_de: string | null; periodo_ate: string | null; linhas: number; campanhas: number; chamadas: number; mensagem: string | null; iniciado_em: string; finalizado_em: string | null }

const STATUS_SYNC: Record<string, string> = {
  ok: 'text-brand-lima', parcial: 'text-amber-300', erro: 'text-brand-rosa', rodando: 'text-brand-lavanda/60',
}

export default function ConfiguracoesAnunciosPage() {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [log, setLog] = useState<Sync[]>([])
  const [pixels, setPixels] = useState<Pixel[]>([])
  const [eventosPixel, setEventosPixel] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient() as any
    async function load() {
      const [m, c, l, p, ev] = await Promise.all([
        supabase.from('anuncio_marcas').select(COLUNAS_MARCA).order('nome'),
        supabase.from('anuncio_contas').select('id, plataforma, account_id, nome, historico_desde, backfill_concluido_em, ultima_sync_em').order('created_at'),
        supabase.from('anuncio_sincronizacoes').select('*').order('iniciado_em', { ascending: false }).limit(20),
        supabase.from('anuncio_pixels').select('pixel_id, nome, marca_id, ultimo_disparo, historico_desde, erro').order('nome'),
        // Eventos já vistos nos pixels (inclui personalizados), para o editor do funil.
        supabase.from('anuncio_pixel_eventos_diarios').select('evento').order('data', { ascending: false }).limit(1000),
      ])
      if (m.error || c.error) setErro('Não foi possível carregar. A migration de anúncios já foi aplicada no Supabase?')
      setMarcas(m.data ?? [])
      setContas(c.data ?? [])
      setLog(l.data ?? [])
      setPixels(p.data ?? [])
      setEventosPixel([...new Set<string>((ev.data ?? []).map((x: { evento: string }) => x.evento))].sort())
      setLoading(false)
    }
    load()
  }, [recarregar])

  async function sincronizar() {
    setSincronizando(true)
    setAviso(null)
    try {
      const r = await fetch('/api/cron/anuncios')
      const corpo = await r.json().catch(() => ({}))
      if (!r.ok) setAviso(corpo.error ?? 'Falha ao sincronizar.')
      else {
        const res = (corpo.resultados ?? []) as { status: string; linhas: number; mensagem?: string }[]
        setAviso(res.map((x) => `${x.status === 'ok' ? 'Pronto' : x.status === 'parcial' ? 'Parcial' : x.status === 'ignorada' ? 'Ignorada' : 'Erro'}: ${x.linhas} linhas${x.mensagem ? ` · ${x.mensagem}` : ''}`).join(' | ') || 'Nenhuma conta ativa.')
      }
    } catch {
      setAviso('Falha ao sincronizar.')
    }
    setSincronizando(false)
    setRecarregar((n) => n + 1)
  }

  const nomeConta = (id: string) => contas.find((c) => c.id === id)?.nome ?? '—'

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Anúncios" description="Configurações" />

      <main className="flex-1 p-4 md:p-6">
        <AnunciosSubNav />
        <PageHeader title="Configurações" description="Marcas, chaves de API, contas de anúncio e sincronização com o Meta.">
          <Button onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar agora
          </Button>
        </PageHeader>

        {erro && <p className="mb-4 text-sm text-brand-rosa">{erro}</p>}
        {aviso && <p className="mb-4 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-brand-lavanda/80">{aviso}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-lavanda/40 text-sm">Carregando...</div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Marcas</CardTitle>
                <p className="text-xs text-brand-lavanda/40">
                  A campanha é da marca quando o nome começa com um dos prefixos, seguido de espaço ou separador
                  (ex.: <code>CP | VENDAS | SITE</code>). O primeiro prefixo é o padrão novo; os outros cobrem nomes antigos.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {marcas.map((m) => <MarcaForm key={m.id} marca={m} eventosPixel={eventosPixel} onSalvo={() => setRecarregar((n) => n + 1)} />)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pixels</CardTitle>
                <p className="text-xs text-brand-lavanda/40">
                  Descobertos na sincronização. Ligue cada pixel à marca do site em que ele está: é ele que alimenta o funil “Site (todo o tráfego)”.
                  Guarda até 90 dias de histórico. Se der “sem permissão”, atribua o pixel ao Usuário do Sistema no Business Manager.
                </p>
              </CardHeader>
              <CardContent className="divide-y divide-white/[0.04]">
                {pixels.length === 0 ? <p className="py-4 text-center text-sm text-brand-lavanda/40">Nenhum pixel ainda. Clique em “Atualizar agora”.</p> : pixels.map((px) => (
                  <div key={px.pixel_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="text-brand-lavanda">{px.nome} <span className="text-brand-lavanda/40">· {px.pixel_id}</span></p>
                      <p className="text-xs text-brand-lavanda/40">
                        Último disparo: {px.ultimo_disparo ? formatRelative(px.ultimo_disparo) : '—'}
                        {px.historico_desde && ` · dados desde ${formatDate(px.historico_desde)}`}
                      </p>
                      {px.erro && <p className="text-xs text-brand-rosa">{px.erro}</p>}
                    </div>
                    <Select value={px.marca_id ?? 'nenhuma'} onValueChange={async (v) => {
                      const { error } = await (createClient() as any).from('anuncio_pixels').update({ marca_id: v === 'nenhuma' ? null : v }).eq('pixel_id', px.pixel_id)
                      if (error) setAviso('Não foi possível ligar o pixel à marca.')
                      else setRecarregar((n) => n + 1)
                    }}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {marcas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                        <SelectItem value="nenhuma">Sem marca</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Contas de anúncio</CardTitle></CardHeader>
              <CardContent className="divide-y divide-white/[0.04]">
                {contas.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <p className="text-brand-lavanda">{c.nome} <span className="text-brand-lavanda/40">· {c.plataforma === 'meta' ? 'Meta' : 'Google Ads (em breve)'} · {c.account_id}</span></p>
                      <p className="text-xs text-brand-lavanda/40">
                        {c.backfill_concluido_em
                          ? `Histórico completo carregado (desde ${formatDate(c.historico_desde)}, limite de 37 meses do Meta)`
                          : c.historico_desde
                            ? `Carregando o histórico: já desde ${formatDate(c.historico_desde)}. Continua a cada sincronização (ou clique em “Atualizar agora”).`
                            : 'Histórico ainda não carregado'}
                      </p>
                    </div>
                    <p className="text-xs text-brand-lavanda/50">Última sincronização: {c.ultima_sync_em ? formatRelative(c.ultima_sync_em) : 'nunca'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sincronizações</CardTitle>
                <p className="text-xs text-brand-lavanda/40">Todo dia às 06:00 (horário de Brasília) e pelo botão “Atualizar agora”. Sempre reprocessa os últimos 7 dias; o histórico (até 37 meses) vai sendo completado de trás para frente.</p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {log.length === 0 ? <p className="py-6 text-center text-sm text-brand-lavanda/40">Nenhuma sincronização ainda.</p> : (
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-left text-xs text-brand-lavanda/40">
                        <th className="py-2 pr-3 font-normal">Quando</th>
                        <th className="py-2 pr-3 font-normal">Conta</th>
                        <th className="py-2 pr-3 font-normal">Origem</th>
                        <th className="py-2 pr-3 font-normal">Status</th>
                        <th className="py-2 pr-3 font-normal">Período</th>
                        <th className="py-2 pr-3 text-right font-normal">Linhas</th>
                        <th className="py-2 pr-3 text-right font-normal">Chamadas</th>
                        <th className="py-2 font-normal">Mensagem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.map((s) => (
                        <tr key={s.id} className="border-b border-white/[0.04] align-top">
                          <td className="py-2 pr-3 whitespace-nowrap text-brand-lavanda/70">{formatDate(s.iniciado_em, 'dd/MM HH:mm')}</td>
                          <td className="py-2 pr-3 text-brand-lavanda/70">{nomeConta(s.conta_id)}</td>
                          <td className="py-2 pr-3 text-brand-lavanda/50">{s.gatilho === 'cron' ? 'Automática' : 'Manual'}</td>
                          <td className={cn('py-2 pr-3 font-medium', STATUS_SYNC[s.status])}>{s.status}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-brand-lavanda/50">{s.periodo_de ? `${formatDate(s.periodo_de, 'dd/MM')} – ${formatDate(s.periodo_ate, 'dd/MM')}` : '—'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-brand-lavanda/70">{s.linhas}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-brand-lavanda/50">{s.chamadas}</td>
                          <td className="py-2 text-xs text-brand-lavanda/50">{s.mensagem ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

function MarcaForm({ marca, eventosPixel, onSalvo }: { marca: Marca; eventosPixel: string[]; onSalvo: () => void }) {
  const [nome, setNome] = useState(marca.nome)
  const [prefixos, setPrefixos] = useState(marca.prefixos.join(', '))
  const [cor, setCor] = useState(marca.cor)
  const [ativo, setAtivo] = useState(marca.ativo)
  const [salvando, setSalvando] = useState(false)
  const [chave, setChave] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const alterado = nome !== marca.nome || prefixos !== marca.prefixos.join(', ') || cor !== marca.cor || ativo !== marca.ativo

  async function salvar() {
    setSalvando(true)
    const lista = prefixos.split(',').map((p) => p.trim()).filter(Boolean)
    const { error } = await (createClient() as any).from('anuncio_marcas')
      .update({ nome: nome.trim(), prefixos: lista, cor, ativo }).eq('id', marca.id)
    setSalvando(false)
    setMsg(error ? 'Não foi possível salvar.' : 'Salvo. A atribuição automática é refeita na próxima sincronização.')
    if (!error) onSalvo()
  }

  async function gerarChave() {
    if (marca.api_key_criada_em && !window.confirm('Gerar uma chave nova invalida a atual na hora. Continuar?')) return
    setSalvando(true)
    const r = await fetch(`/api/anuncios/marcas/${marca.id}/chave`, { method: 'POST' })
    const corpo = await r.json().catch(() => ({}))
    setSalvando(false)
    if (!r.ok) return setMsg(corpo.error ?? 'Não foi possível gerar a chave.')
    setChave(corpo.chave)
    setMsg(null)
  }

  return (
    <div className="rounded-xl border border-white/[0.06] p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Prefixos (separados por vírgula)</Label>
          <Input value={prefixos} onChange={(e) => setPrefixos(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Cor</Label>
          <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 w-14 cursor-pointer rounded-lg border border-white/[0.12] bg-transparent" />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm text-brand-lavanda/70">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativa
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={salvar} disabled={!alterado || salvando}>Salvar</Button>
        <Button size="sm" variant="outline" onClick={gerarChave} disabled={salvando}>
          <KeyRound className="h-3.5 w-3.5" />{marca.api_key_criada_em ? 'Gerar chave nova' : 'Gerar chave de API'}
        </Button>
        <span className="text-xs text-brand-lavanda/40">
          slug <code>{marca.slug}</code> · {marca.api_key_criada_em ? `chave criada em ${formatDate(marca.api_key_criada_em)}` : 'sem chave'}
        </span>
      </div>

      {chave && (
        <div className="mt-3 rounded-lg border border-brand-lima/20 bg-brand-lima/[0.05] p-3 text-xs">
          <p className="mb-2 text-brand-lavanda/80">Copie agora: esta chave não será mostrada de novo. Guarde só no servidor do produto (variável de ambiente).</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-black/30 px-2 py-1.5 text-brand-lima">{chave}</code>
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(chave)}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-brand-lavanda/60">{msg}</p>}
      <EditorFunil marcaId={marca.id} inicial={marca.funil ?? []} eventosPixel={eventosPixel} />
    </div>
  )
}

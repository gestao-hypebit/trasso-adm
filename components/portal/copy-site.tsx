'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, MessageSquare, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TextoCopy } from '@/components/sites-clientes/texto-copy'
import { aprovarCopyRestante, responderCopy } from '@/app/portal/[token]/actions'
import { cn } from '@/lib/utils'
import { resumoCopy, type CopySecao } from '@/lib/sites-clientes/copy'

export type CopySiteData = { id: string; nome: string; secoes: CopySecao[] }

const CHAVE_NOME = 'slick-portal-nome'

export function CopySite({ token, sites }: { token: string; sites: CopySiteData[] }) {
  const [nome, setNome] = useState('')

  useEffect(() => {
    try { setNome(localStorage.getItem(CHAVE_NOME) ?? '') } catch {}
  }, [])
  function guardarNome(v: string) {
    setNome(v)
    try { localStorage.setItem(CHAVE_NOME, v) } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="font-semibold text-brand-lavanda">Revise os textos do seu site</p>
        <p className="mt-1 text-sm text-brand-lavanda/55">
          Leia seção por seção. Se estiver tudo certo, aprove. Se quiser mudar algo, peça ajuste e conte o que mudar:
          a gente ajusta e te manda de novo. O site começa a ser desenvolvido com os textos aprovados.
        </p>
        <div className="mt-4 max-w-xs space-y-1.5">
          <label htmlFor="copy-nome" className="text-xs text-brand-lavanda/60">Seu nome (fica registrado na aprovação)</label>
          <Input id="copy-nome" value={nome} onChange={(e) => guardarNome(e.target.value)} placeholder="Nome completo" autoComplete="name" />
        </div>
      </div>
      {sites.map((site) => <CopyDoSite key={site.id} token={token} site={site} nome={nome} varios={sites.length > 1} />)}
    </div>
  )
}

function CopyDoSite({ token, site, nome, varios }: { token: string; site: CopySiteData; nome: string; varios: boolean }) {
  const [secoes, setSecoes] = useState(site.secoes)
  const [aprovandoTudo, setAprovandoTudo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const r = resumoCopy(secoes)

  function atualizar(id: string, patch: Partial<CopySecao>) {
    setSecoes((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  async function aprovarTudo() {
    if (nome.trim().length < 3) return setErro('Informe seu nome lá em cima antes de aprovar.')
    if (!window.confirm(`Aprovar as ${r.aguardando} seções que faltam?`)) return
    setAprovandoTudo(true)
    setErro(null)
    const res = await aprovarCopyRestante(token, site.id, nome)
    setAprovandoTudo(false)
    if (!res.success) return setErro(res.error)
    const agora = new Date().toISOString()
    setSecoes((ss) => ss.map((s) => (s.status === 'aguardando' ? { ...s, status: 'aprovada', respondido_nome: nome, respondido_em: agora } : s)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[200px] flex-1">
          {varios && <p className="mb-1 font-semibold text-brand-lavanda">{site.nome}</p>}
          <p className="text-sm text-brand-lavanda/70"><span className="font-semibold text-brand-lavanda">{r.aprovadas} de {r.enviadas}</span> seções aprovadas</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-brand-lima transition-all" style={{ width: `${r.enviadas ? (r.aprovadas / r.enviadas) * 100 : 0}%` }} />
          </div>
        </div>
        {r.aguardando > 1 && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={aprovarTudo} disabled={aprovandoTudo}>
            {aprovandoTudo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aprovar todas as restantes
          </Button>
        )}
      </div>
      {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
      {r.aguardando === 0 && r.ajustes === 0 && r.aprovadas > 0 && (
        <p className="rounded-lg bg-brand-lima/10 px-4 py-3 text-sm text-brand-lima">Tudo aprovado! Obrigado. Agora a gente parte para o desenvolvimento do site.</p>
      )}
      {secoes.filter((s) => s.status !== 'rascunho').map((s, i) => (
        <SecaoCliente key={s.id} token={token} secao={s} numero={i + 1} nome={nome} onAtualizar={(p) => atualizar(s.id, p)} />
      ))}
    </div>
  )
}

function SecaoCliente({ token, secao: s, numero, nome, onAtualizar }: {
  token: string
  secao: CopySecao
  numero: number
  nome: string
  onAtualizar: (p: Partial<CopySecao>) => void
}) {
  const [pedindo, setPedindo] = useState(false)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function responder(aprovar: boolean) {
    if (nome.trim().length < 3) return setErro('Informe seu nome lá em cima antes de responder.')
    if (!aprovar && !comentario.trim()) return setErro('Conte o que precisa mudar.')
    setEnviando(true)
    setErro(null)
    const r = await responderCopy(token, s.id, { aprovar, nome, comentario })
    setEnviando(false)
    if (!r.success) return setErro(r.error)
    onAtualizar({
      status: aprovar ? 'aprovada' : 'ajustes',
      comentario_cliente: aprovar ? null : comentario.trim(),
      respondido_nome: nome,
      respondido_em: new Date().toISOString(),
    })
    setPedindo(false)
  }

  return (
    <div className={cn('rounded-xl border bg-white/[0.02] p-5 md:p-6', {
      'border-white/[0.1]': s.status === 'aguardando',
      'border-brand-lima/25': s.status === 'aprovada',
      'border-yellow-500/25': s.status === 'ajustes',
    })}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs text-brand-lavanda/30">{String(numero).padStart(2, '0')}</span>
        <h3 className="flex-1 text-lg font-semibold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{s.titulo}</h3>
        {s.status === 'aprovada' && <span className="flex items-center gap-1 text-xs font-medium text-brand-lima"><Check className="h-3.5 w-3.5" /> Aprovada</span>}
        {s.status === 'ajustes' && <span className="flex items-center gap-1 text-xs font-medium text-yellow-400"><PenLine className="h-3.5 w-3.5" /> Em ajuste pela Slick</span>}
      </div>

      {s.observacao && <p className="mb-4 rounded-lg bg-white/[0.03] px-3 py-2 text-sm italic text-brand-lavanda/55">{s.observacao}</p>}

      <div className="space-y-5">
        {s.campos.filter((c) => c.texto.trim()).map((c) => (
          <div key={c._id}>
            {c.rotulo && <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-brand-lavanda/35">{c.rotulo}</p>}
            <TextoCopy texto={c.texto} className="text-[15.5px] leading-relaxed text-brand-lavanda/90" />
          </div>
        ))}
      </div>

      {s.status === 'ajustes' && s.comentario_cliente && (
        <div className="mt-5 rounded-lg bg-yellow-500/[0.07] p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-medium text-yellow-400"><MessageSquare className="h-3.5 w-3.5" /> Seu pedido</p>
          <p className="mt-1 whitespace-pre-line text-brand-lavanda/80">{s.comentario_cliente}</p>
          <p className="mt-2 text-xs text-brand-lavanda/45">A gente vai ajustar e te mandar de novo para aprovar.</p>
        </div>
      )}

      {s.status === 'aguardando' && (
        <div className="mt-6 border-t border-white/[0.06] pt-4">
          {pedindo ? (
            <div className="space-y-2">
              <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} autoFocus
                placeholder="O que você quer mudar? Pode colar o texto do jeito que prefere." />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => responder(false)} disabled={enviando || !comentario.trim()} className="gap-1.5">
                  {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enviar pedido de ajuste
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPedindo(false)} disabled={enviando}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => responder(true)} disabled={enviando} className="gap-1.5">
                {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aprovar seção
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPedindo(true)} disabled={enviando} className="gap-1.5">
                <PenLine className="h-3.5 w-3.5" /> Pedir ajuste
              </Button>
            </div>
          )}
          {erro && <p className="mt-2 text-sm text-brand-rosa">{erro}</p>}
        </div>
      )}
    </div>
  )
}

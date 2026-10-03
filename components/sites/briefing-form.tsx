'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ESTILOS, SECOES, SECOES_PADRAO, TONS, type Briefing } from '@/lib/sites/tipos'

// Formulário do briefing (criar prévia e editar briefing).
// `pasta` é onde as imagens vão no bucket "sites".
export function BriefingForm({ valor, onChange, pasta }: { valor: Briefing; onChange: (b: Briefing) => void; pasta: string }) {
  const set = <K extends keyof Briefing>(k: K, v: Briefing[K]) => onChange({ ...valor, [k]: v })
  const secoes = valor.secoes ?? SECOES_PADRAO

  return (
    <div className="space-y-5">
      <Bloco titulo="A empresa">
        <Campo rotulo="Nome da empresa *" className="sm:col-span-2">
          <Input value={valor.empresa} onChange={(e) => set('empresa', e.target.value)} placeholder="Ex.: Doces Dona Lázara" />
        </Campo>
        <Campo rotulo="Segmento">
          <Input value={valor.segmento ?? ''} onChange={(e) => set('segmento', e.target.value)} placeholder="Ex.: confeitaria artesanal" />
        </Campo>
        <Campo rotulo="Cidade / região">
          <Input value={valor.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} placeholder="Ex.: Franca - SP" />
        </Campo>
        <Campo rotulo="O que a empresa faz" className="sm:col-span-2">
          <Textarea rows={3} value={valor.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} placeholder="Conte a história, o que vende, há quanto tempo, como trabalha…" />
        </Campo>
        <Campo rotulo="Público-alvo" className="sm:col-span-2">
          <Input value={valor.publico ?? ''} onChange={(e) => set('publico', e.target.value)} placeholder="Ex.: famílias e empresas que fazem eventos" />
        </Campo>
      </Bloco>

      <Bloco titulo="Oferta">
        <Campo rotulo="Serviços / produtos (um por linha)" className="sm:col-span-2">
          <Textarea rows={4} value={valor.servicos ?? ''} onChange={(e) => set('servicos', e.target.value)} />
        </Campo>
        <Campo rotulo="Diferenciais" className="sm:col-span-2">
          <Textarea rows={3} value={valor.diferenciais ?? ''} onChange={(e) => set('diferenciais', e.target.value)} placeholder="O que faz o cliente escolher essa empresa e não a concorrente" />
        </Campo>
        <Campo rotulo="Objetivo do site" className="sm:col-span-2">
          <Input value={valor.objetivo ?? ''} onChange={(e) => set('objetivo', e.target.value)} placeholder="Ex.: receber pedidos de orçamento pelo WhatsApp" />
        </Campo>
      </Bloco>

      <Bloco titulo="Estilo">
        <Campo rotulo="Tom de voz">
          <Escolha valor={valor.tom} opcoes={TONS} onChange={(v) => set('tom', v)} />
        </Campo>
        <Campo rotulo="Estilo visual">
          <Escolha valor={valor.estilo} opcoes={ESTILOS} onChange={(v) => set('estilo', v)} />
        </Campo>
        <Campo rotulo="Cor principal">
          <Cor valor={valor.corPrimaria} onChange={(v) => set('corPrimaria', v)} />
        </Campo>
        <Campo rotulo="Cor secundária">
          <Cor valor={valor.corSecundaria} onChange={(v) => set('corSecundaria', v)} />
        </Campo>
        <Campo rotulo="Seções do site" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {SECOES.map((s) => {
              const ativa = secoes.includes(s.value)
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set('secoes', ativa ? secoes.filter((x) => x !== s.value) : [...secoes, s.value])}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                    ativa ? 'border-brand-lima/40 bg-brand-lima/10 text-brand-lima' : 'border-white/[0.1] text-brand-lavanda/50 hover:text-brand-lavanda'
                  )}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </Campo>
      </Bloco>

      <Bloco titulo="Imagens" descricao="Logo e fotos reais deixam a prévia com cara de site pronto. Sem fotos, a IA monta o visual com cores e formas.">
        <Campo rotulo="Logo">
          <Upload pasta={pasta} urls={valor.logoUrl ? [valor.logoUrl] : []} onChange={(u) => set('logoUrl', u[0])} max={1} />
        </Campo>
        <Campo rotulo="Fotos">
          <Upload pasta={pasta} urls={valor.fotos ?? []} onChange={(u) => set('fotos', u)} max={8} />
        </Campo>
      </Bloco>

      <Bloco titulo="Contatos">
        <Campo rotulo="WhatsApp"><Input value={valor.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="(16) 99999-9999" /></Campo>
        <Campo rotulo="Telefone"><Input value={valor.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} /></Campo>
        <Campo rotulo="E-mail"><Input value={valor.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Campo>
        <Campo rotulo="Instagram"><Input value={valor.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} placeholder="@empresa" /></Campo>
        <Campo rotulo="Endereço" className="sm:col-span-2"><Input value={valor.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} /></Campo>
        <Campo rotulo="Site atual" className="sm:col-span-2"><Input value={valor.siteAtual ?? ''} onChange={(e) => set('siteAtual', e.target.value)} placeholder="Se já tiver um" /></Campo>
      </Bloco>

      <Bloco titulo="Mais detalhes">
        <Campo rotulo="Referências (sites que o cliente gosta e por quê)" className="sm:col-span-2">
          <Textarea rows={2} value={valor.referencias ?? ''} onChange={(e) => set('referencias', e.target.value)} />
        </Campo>
        <Campo rotulo="Observações para a IA" className="sm:col-span-2">
          <Textarea rows={3} value={valor.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} placeholder="Qualquer coisa que você quer no site: promoções, horários, o que evitar…" />
        </Campo>
      </Bloco>
    </div>
  )
}

function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descricao && <p className="text-xs text-brand-lavanda/40">{descricao}</p>}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  )
}

function Campo({ rotulo, className, children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs text-brand-lavanda/80">{rotulo}</Label>
      {children}
    </div>
  )
}

function Escolha({ valor, opcoes, onChange }: { valor?: string; opcoes: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={valor ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-brand-lavanda outline-none focus:border-brand-violeta/60"
    >
      <option value="" className="bg-brand-noite">A IA escolhe</option>
      {opcoes.map((o) => <option key={o} value={o} className="bg-brand-noite">{o}</option>)}
    </select>
  )
}

function Cor({ valor, onChange }: { valor?: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={valor || '#7c3aed'}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-9 w-12 cursor-pointer rounded-lg border border-white/[0.1] bg-transparent', !valor && 'opacity-40')}
      />
      <span className="text-xs text-brand-lavanda/50">{valor || 'A IA escolhe'}</span>
      {valor && <button type="button" onClick={() => onChange(undefined)} className="text-xs text-brand-lavanda/40 hover:text-brand-lavanda">limpar</button>}
    </div>
  )
}

function Upload({ pasta, urls, onChange, max }: { pasta: string; urls: string[]; onChange: (u: string[]) => void; max: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return
    setEnviando(true)
    setErro(null)
    const supabase = createClient()
    const novas: string[] = []
    for (const f of Array.from(arquivos).slice(0, max - urls.length)) {
      if (!f.type.startsWith('image/')) continue
      const ext = f.name.split('.').pop()?.toLowerCase() || 'png'
      const caminho = `${pasta}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('sites').upload(caminho, f, { contentType: f.type })
      if (error) { setErro(error.message); continue }
      novas.push(supabase.storage.from('sites').getPublicUrl(caminho).data.publicUrl)
    }
    onChange([...urls, ...novas].slice(0, max))
    setEnviando(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {urls.map((u) => (
          <div key={u} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-white/[0.1] bg-white/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-full w-full object-contain" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((x) => x !== u))}
              aria-label="Remover imagem"
              className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {urls.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={enviando}
            className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-white/[0.15] text-brand-lavanda/40 transition-colors hover:border-white/[0.3] hover:text-brand-lavanda"
            aria-label="Enviar imagem"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple={max > 1} className="hidden" onChange={(e) => enviar(e.target.files)} />
      {erro && <p className="mt-1 text-xs text-brand-rosa">{erro}</p>}
    </div>
  )
}

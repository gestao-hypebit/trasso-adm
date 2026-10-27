'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, CheckCircle2, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { enviarBriefing } from '@/app/briefing/[token]/actions'
import { MODELOS_BRIEFING, errosDoBriefing, etapasDoModelo, type ModeloBriefing, type Pergunta, type Resposta, type Respostas } from '@/lib/social/briefing'
import { cn } from '@/lib/utils'

type Agencia = { nome: string; logoUrl: string | null }

const chaveRascunho = (token: string) => `slick-briefing-${token}`

export function BriefingTopo({ nome, logoUrl }: Agencia) {
  return (
    <header className="border-b border-white/[0.06]">
      <div className="mx-auto flex max-w-xl items-center gap-2 px-5 py-3">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-brand-lima">
          {logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoUrl} alt={nome} className="h-full w-full object-contain" />
            : <span className="text-sm font-black text-brand-noite">{nome[0]}</span>}
        </div>
        <div>
          <p className="text-sm font-bold leading-none text-brand-lavanda">{nome.toLowerCase()}</p>
          <p className="mt-0.5 text-[10px] text-brand-lavanda/40">Briefing de social media</p>
        </div>
      </div>
    </header>
  )
}

export function BriefingObrigado(agencia: Agencia) {
  return (
    <div className="min-h-screen bg-brand-noite">
      <BriefingTopo {...agencia} />
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-brand-lima" />
        <h1 className="mb-2 text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Recebemos tudo!</h1>
        <p className="text-brand-lavanda/60">Em breve te enviamos o planejamento.</p>
      </div>
    </div>
  )
}

export function BriefingFormulario({ token, modelo, contatoNome, nome, logoUrl }: Agencia & {
  token: string
  modelo: ModeloBriefing
  contatoNome: string
}) {
  const etapas = etapasDoModelo(modelo)
  const [respostas, setRespostas] = useState<Respostas>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [pendente, startTransition] = useTransition()
  const [carregou, setCarregou] = useState(false)

  // Rascunho no navegador: se fechar a aba e voltar, o que foi digitado continua aqui.
  useEffect(() => {
    let salvo: Respostas | null = null
    try { salvo = JSON.parse(localStorage.getItem(chaveRascunho(token)) ?? 'null') } catch {}
    setRespostas(salvo ?? (contatoNome ? { responsavel: contatoNome } : {}))
    setCarregou(true)
  }, [token, contatoNome])

  useEffect(() => {
    if (!carregou) return
    try { localStorage.setItem(chaveRascunho(token), JSON.stringify(respostas)) } catch {}
  }, [token, respostas, carregou])

  function mudar(chave: string, valor: Resposta) {
    setRespostas((r) => ({ ...r, [chave]: valor }))
    if (erros[chave]) setErros(({ [chave]: _, ...resto }) => resto)
  }

  function mostrarErros(novos: Record<string, string>) {
    setErros(novos)
    const total = Object.keys(novos).length
    setAviso(`Falta${total > 1 ? 'm' : ''} ${total} resposta${total > 1 ? 's' : ''}. Confira o${total > 1 ? 's' : ''} campo${total > 1 ? 's' : ''} marcado${total > 1 ? 's' : ''} em rosa.`)
    // Rola até o primeiro campo faltando, na ordem do formulário.
    const primeira = MODELOS_BRIEFING[modelo].perguntas.find((q) => novos[q.chave])
    const el = primeira && document.getElementById(`campo-${primeira.chave}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true })
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setAviso(null)
    const locais = errosDoBriefing(modelo, respostas)
    if (Object.keys(locais).length) { mostrarErros(locais); return }
    startTransition(async () => {
      const r = await enviarBriefing(token, respostas)
      if (r.success) {
        try { localStorage.removeItem(chaveRascunho(token)) } catch {}
        setEnviado(true)
        window.scrollTo({ top: 0 })
      } else if (r.erros) {
        mostrarErros(r.erros)
      } else {
        setAviso(r.error)
      }
    })
  }

  if (enviado) return <BriefingObrigado nome={nome} logoUrl={logoUrl} />

  return (
    <div className="min-h-screen bg-brand-noite">
      <BriefingTopo nome={nome} logoUrl={logoUrl} />

      <form onSubmit={enviar} noValidate className="mx-auto max-w-xl space-y-10 px-5 pb-16 pt-6">
        <p className="flex items-center gap-2 rounded-lg border border-brand-lima/20 bg-brand-lima/[0.06] px-3 py-2 text-sm text-brand-lima">
          <Lock className="h-4 w-4 shrink-0" /> Nenhuma senha é pedida aqui.
        </p>

        <section>
          <h1 className="text-3xl font-bold leading-tight text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Vamos conhecer a sua loja</h1>
          <p className="mt-2 text-brand-lavanda/60">Leva uns 5 minutos. O que você digitar fica salvo neste aparelho até você enviar.</p>
          <p className="mt-1 text-sm text-brand-lavanda/40">Campos com <span className="text-brand-rosa">*</span> são obrigatórios.</p>
        </section>

        {etapas.map((etapa, i) => (
          <section key={etapa.titulo} className="space-y-6">
            <div className="flex items-center gap-3 border-b border-white/[0.06] pb-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-lima text-sm font-bold text-brand-noite">{i + 1}</span>
              <h2 className="text-lg font-semibold text-brand-lavanda">{etapa.titulo}</h2>
            </div>
            {etapa.perguntas.map((q) => (
              <Campo key={q.chave} pergunta={q} valor={respostas[q.chave]} erro={erros[q.chave]} onChange={(v) => mudar(q.chave, v)} />
            ))}
          </section>
        ))}

        <div className="space-y-3">
          {aviso && <p role="alert" className="rounded-lg border border-brand-rosa/25 bg-brand-rosa/[0.06] px-3 py-2 text-sm text-brand-rosa">{aviso}</p>}
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pendente}>
            {pendente ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar respostas'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Campo({ pergunta: q, valor, erro, onChange }: {
  pergunta: Pergunta
  valor: Resposta | undefined
  erro: string | undefined
  onChange: (v: Resposta) => void
}) {
  const id = `input-${q.chave}`
  const texto = typeof valor === 'string' ? valor : ''
  // text-base evita o zoom automático do iPhone ao focar o campo.
  const classeCampo = cn('text-base', erro && 'border-brand-rosa/60')

  return (
    <div id={`campo-${q.chave}`} className="scroll-mt-6 space-y-2">
      <label htmlFor={q.opcoes ? undefined : id} className="block font-medium text-brand-lavanda">
        {q.rotulo}{q.obrigatoria && <span className="text-brand-rosa"> *</span>}
      </label>

      {q.tipo === 'texto_longo' ? (
        <Textarea id={id} rows={4} className={classeCampo} placeholder={q.placeholder} value={texto} onChange={(e) => onChange(e.target.value)} aria-invalid={!!erro} />
      ) : q.opcoes ? (
        <Chips pergunta={q} valor={valor} onChange={onChange} />
      ) : (
        <Input
          id={id}
          className={cn('h-12', classeCampo)}
          type={q.tipo === 'email' ? 'email' : q.tipo === 'telefone' ? 'tel' : 'text'}
          inputMode={q.tipo === 'telefone' ? 'tel' : q.tipo === 'email' ? 'email' : undefined}
          autoComplete={q.tipo === 'telefone' ? 'tel' : q.tipo === 'email' ? 'email' : 'off'}
          autoCapitalize={q.tipo === 'email' || q.chave.includes('arroba') || q.chave.includes('instagram') ? 'none' : undefined}
          placeholder={q.placeholder}
          value={texto}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!erro}
        />
      )}

      {q.ajuda && <p className="text-sm text-brand-lavanda/50">{q.ajuda}</p>}
      {erro && <p className="text-sm font-medium text-brand-rosa">{erro}</p>}
    </div>
  )
}

function Chips({ pergunta: q, valor, onChange }: { pergunta: Pergunta; valor: Resposta | undefined; onChange: (v: Resposta) => void }) {
  const multipla = q.tipo === 'multipla_escolha'
  const marcadas = Array.isArray(valor) ? valor : valor ? [valor] : []

  function tocar(opcao: string) {
    if (multipla) onChange(marcadas.includes(opcao) ? marcadas.filter((o) => o !== opcao) : [...marcadas, opcao])
    else onChange(marcadas.includes(opcao) ? '' : opcao)
  }

  return (
    <div role="group" aria-label={q.rotulo} className="flex flex-wrap gap-2">
      {multipla && <p className="w-full text-xs text-brand-lavanda/40">Pode marcar mais de uma.</p>}
      {q.opcoes!.map((opcao) => {
        const ativa = marcadas.includes(opcao)
        return (
          <button
            key={opcao}
            type="button"
            aria-pressed={ativa}
            onClick={() => tocar(opcao)}
            className={cn(
              'flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-left text-[15px] transition-colors',
              ativa
                ? 'border-brand-lima bg-brand-lima/15 font-medium text-brand-lima'
                : 'border-white/[0.12] bg-white/[0.03] text-brand-lavanda/80 active:bg-white/[0.08]',
            )}
          >
            {ativa && <Check className="h-4 w-4 shrink-0" />} {opcao}
          </button>
        )
      })}
    </div>
  )
}

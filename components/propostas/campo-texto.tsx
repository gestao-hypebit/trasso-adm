'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from 'react'
import { List, Plus, WandSparkles } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const BULLET = '• '
const BULLET_RE = /^\s*[-•*]\s+/

function ajustarAltura(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + 2}px`
}

// Enter numa linha de lista continua a lista; Enter numa linha de lista vazia encerra.
function continuarLista(e: KeyboardEvent<HTMLTextAreaElement>, aplicar: (texto: string, cursor: number) => void) {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
  const el = e.currentTarget
  const { value, selectionStart, selectionEnd } = el
  if (selectionStart !== selectionEnd) return
  const inicioLinha = value.lastIndexOf('\n', selectionStart - 1) + 1
  const linha = value.slice(inicioLinha, selectionStart)
  const marcador = linha.match(BULLET_RE)?.[0]
  if (!marcador) return
  e.preventDefault()
  if (linha.trim() === marcador.trim()) {
    aplicar(value.slice(0, inicioLinha) + value.slice(selectionStart), inicioLinha)
  } else {
    const insert = `\n${marcador}`
    aplicar(value.slice(0, selectionStart) + insert + value.slice(selectionEnd), selectionStart + insert.length)
  }
}

// Textarea que cresce com o conteúdo — usado na descrição dos itens (com register).
export const AutoTextarea = forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, onInput, ...props }, ref) => {
    const inner = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement)
    useEffect(() => {
      const id = requestAnimationFrame(() => ajustarAltura(inner.current))
      return () => cancelAnimationFrame(id)
    })
    return (
      <textarea
        ref={inner}
        rows={1}
        onInput={(e) => { ajustarAltura(e.currentTarget); onInput?.(e) }}
        className={cn(
          'flex w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm leading-snug text-brand-lavanda placeholder:text-brand-lavanda/30 focus:outline-none focus:ring-1 focus:ring-brand-violeta/60 focus:border-brand-violeta/60 resize-none overflow-hidden transition-colors',
          className,
        )}
        {...props}
      />
    )
  },
)
AutoTextarea.displayName = 'AutoTextarea'

type Sugestao = { label: string; texto: string }

export function CampoTexto({
  label, value, onChange, placeholder, ajuda, sugestoes, modelo, minLinhas = 4,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Onde o texto aparece no PDF, dicas de preenchimento. */
  ajuda?: string
  /** Frases prontas inseridas como novos tópicos. */
  sugestoes?: Sugestao[]
  /** Estrutura inicial, oferecida quando o campo está vazio. */
  modelo?: string
  minLinhas?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { ajustarAltura(ref.current) }, [value])

  const aplicar = useCallback((texto: string, cursor?: number) => {
    onChange(texto)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      const pos = cursor ?? texto.length
      el.setSelectionRange(pos, pos)
    })
  }, [onChange])

  // Liga/desliga o marcador de lista nas linhas selecionadas
  function alternarLista() {
    const el = ref.current
    if (!el) return
    const { selectionStart, selectionEnd } = el
    const inicio = value.lastIndexOf('\n', selectionStart - 1) + 1
    const fimIdx = value.indexOf('\n', selectionEnd)
    const fim = fimIdx === -1 ? value.length : fimIdx
    const linhas = value.slice(inicio, fim).split('\n')
    const todasLista = linhas.every(l => BULLET_RE.test(l) || !l.trim())
    const novas = linhas.map(l => {
      if (!l.trim()) return l
      return todasLista ? l.replace(BULLET_RE, '') : BULLET + l.replace(BULLET_RE, '')
    }).join('\n')
    aplicar(value.slice(0, inicio) + novas + value.slice(fim), inicio + novas.length)
  }

  function inserir(texto: string) {
    if (value.includes(texto)) return
    const base = value.trimEnd()
    aplicar(base ? `${base}\n${BULLET}${texto}` : `${BULLET}${texto}`)
  }

  const usadas = new Set((sugestoes ?? []).filter(s => value.includes(s.texto)).map(s => s.label))
  const linhas = value ? value.split('\n').length : 0

  return (
    <div>
      <div className="flex items-end justify-between gap-2 mb-1.5">
        <Label className="text-brand-lavanda/80 text-xs block">{label}</Label>
        <div className="flex items-center gap-1">
          {modelo && !value.trim() && (
            <button type="button" onClick={() => aplicar(modelo)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-brand-lima/80 hover:text-brand-lima hover:bg-white/[0.05] transition-colors">
              <WandSparkles className="h-3 w-3" /> Usar modelo
            </button>
          )}
          <button type="button" onClick={alternarLista} title="Transformar linhas em lista"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-brand-lavanda/50 hover:text-brand-lavanda hover:bg-white/[0.05] transition-colors">
            <List className="h-3 w-3" /> Lista
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.1] bg-white/[0.04] focus-within:ring-1 focus-within:ring-brand-violeta/60 focus-within:border-brand-violeta/60 transition-colors">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => continuarLista(e, aplicar)}
          placeholder={placeholder}
          rows={minLinhas}
          style={{ minHeight: `${minLinhas * 1.6 + 1.25}rem` }}
          className="block w-full bg-transparent px-3.5 py-3 text-sm leading-relaxed text-brand-lavanda placeholder:text-brand-lavanda/30 focus:outline-none resize-none overflow-hidden"
        />

        {sugestoes && sugestoes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] px-3 py-2.5">
            {sugestoes.map(s => {
              const usada = usadas.has(s.label)
              return (
                <button key={s.label} type="button" disabled={usada} onClick={() => inserir(s.texto)} title={s.texto}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                    usada
                      ? 'border-brand-lima/20 text-brand-lima/50 cursor-default'
                      : 'border-white/[0.1] text-brand-lavanda/60 hover:border-brand-violeta/50 hover:text-brand-lavanda hover:bg-brand-violeta/10',
                  )}>
                  {!usada && <Plus className="h-3 w-3" />}{s.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex justify-between gap-3 mt-1.5 text-[11px] text-brand-lavanda/35">
        <span>{ajuda}</span>
        <span className="shrink-0 tabular-nums">{linhas > 0 ? `${linhas} ${linhas === 1 ? 'linha' : 'linhas'} · ${value.length} caracteres` : ''}</span>
      </div>
    </div>
  )
}

export const SUGESTOES_PAGAMENTO: Sugestao[] = [
  { label: '50% / 50%',          texto: '50% na aprovação da proposta e 50% na entrega.' },
  { label: '40% / 30% / 30%',    texto: '40% na assinatura, 30% na entrega intermediária e 30% na entrega final.' },
  { label: 'À vista com desconto', texto: 'Pagamento à vista com 5% de desconto.' },
  { label: 'Cartão em até 6x',   texto: 'Parcelamento em até 6x no cartão de crédito.' },
  { label: 'Mensalidade',        texto: 'Mensalidade via Pix ou boleto, todo dia 10, a partir da implantação.' },
]

export const SUGESTOES_OBSERVACOES: Sugestao[] = [
  { label: 'Prazo de entrega',   texto: 'Prazo estimado de entrega: 30 dias úteis após o envio dos materiais.' },
  { label: 'Rodadas de revisão', texto: 'Inclui até 2 rodadas de revisão por etapa.' },
  { label: 'Fora do escopo',     texto: 'Alterações fora do escopo descrito serão orçadas à parte.' },
  { label: 'Hospedagem/domínio', texto: 'Hospedagem e domínio não estão inclusos, salvo quando listados nos itens.' },
  { label: 'Materiais do cliente', texto: 'Textos, imagens e acessos necessários são fornecidos pelo cliente.' },
  { label: 'Propriedade',        texto: 'Após a quitação, todos os arquivos e direitos de uso passam ao cliente.' },
]

export const MODELO_ESCOPO = `Objetivo
Explique em uma ou duas frases o que o cliente quer alcançar.

Escopo
• Entrega principal
• Entrega secundária

Fora do escopo
• O que não está incluso nesta proposta`

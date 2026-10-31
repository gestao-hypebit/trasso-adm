'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import {
  ERRO_MIGRATION_PERGUNTAS, MODELOS_BRIEFING, TIPOS_PERGUNTA, gerarChave, normalizarPerguntas, perguntasDoBriefing, problemaNasPerguntas, temOpcoes,
  type Briefing, type ModeloBriefing, type Pergunta, type TipoPergunta,
} from '@/lib/social/briefing'
import { cn } from '@/lib/utils'

// Pergunta no editor: as opções viram texto (uma por linha) enquanto edita.
type Item = Omit<Pergunta, 'opcoes'> & { _id: string; _opcoes: string; _nova: boolean }

const paraItem = (q: Pergunta): Item => ({ ...q, ajuda: q.ajuda ?? '', placeholder: q.placeholder ?? '', _id: crypto.randomUUID(), _opcoes: (q.opcoes ?? []).join('\n'), _nova: false })

const ERROS_SEM_COLUNA = ['42P01', '42703', 'PGRST204', 'PGRST205']

// Padrão do modelo: o salvo pelo painel (briefing_modelos) ou o do código.
export async function perguntasPadrao(db: any, modelo: ModeloBriefing): Promise<Pergunta[]> {
  const { data } = await db.from('briefing_modelos').select('perguntas').eq('modelo', modelo).maybeSingle()
  return normalizarPerguntas(data?.perguntas) ?? MODELOS_BRIEFING[modelo].perguntas
}

const campo = 'h-9 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-brand-lavanda outline-none'

// Edita as perguntas de UM briefing (o deste cliente). O link continua o mesmo:
// quem abrir depois de salvar já vê as perguntas novas.
export function EditorPerguntasDialog({ aberto, onClose, briefing, nomeCliente, onSalvo }: {
  aberto: boolean
  onClose: () => void
  briefing: Briefing
  nomeCliente: string
  onSalvo: () => void
}) {
  const [itens, setItens] = useState<Item[]>([])
  const [comoPadrao, setComoPadrao] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const modelo = MODELOS_BRIEFING[briefing.modelo]

  useEffect(() => {
    if (!aberto) return
    setItens(perguntasDoBriefing(briefing).map(paraItem))
    setComoPadrao(false)
    setErro(null)
  }, [aberto, briefing])

  const mudar = (id: string, campos: Partial<Item>) => setItens((l) => l.map((i) => (i._id === id ? { ...i, ...campos } : i)))
  const remover = (id: string) => setItens((l) => l.filter((i) => i._id !== id))
  function mover(indice: number, delta: number) {
    setItens((l) => {
      const alvo = indice + delta
      if (alvo < 0 || alvo >= l.length) return l
      const nova = [...l]
      ;[nova[indice], nova[alvo]] = [nova[alvo], nova[indice]]
      return nova
    })
  }
  function adicionar() {
    setItens((l) => [...l, {
      _id: crypto.randomUUID(), _nova: true, _opcoes: '',
      chave: '', etapa: l[l.length - 1]?.etapa ?? 'Perguntas', rotulo: '', tipo: 'texto', obrigatoria: false, ajuda: '', placeholder: '',
    }])
    setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
  }

  async function restaurar(origem: 'salvo' | 'codigo') {
    const lista = origem === 'codigo' ? modelo.perguntas : await perguntasPadrao(createClient(), briefing.modelo)
    setItens(lista.map(paraItem))
  }

  async function salvar() {
    // Chaves das perguntas existentes não mudam (é onde a resposta fica guardada).
    const usadas = new Set(itens.filter((i) => !i._nova).map((i) => i.chave))
    const lista: Pergunta[] = itens.map(({ _id, _opcoes, _nova, ...q }) => {
      const chave = _nova ? gerarChave(q.rotulo, usadas) : q.chave
      usadas.add(chave)
      return {
        ...q, chave,
        opcoes: temOpcoes(q.tipo) ? _opcoes.split('\n').map((o) => o.trim()).filter(Boolean) : undefined,
        ajuda: q.ajuda?.trim() || undefined,
        placeholder: !temOpcoes(q.tipo) && q.placeholder?.trim() ? q.placeholder.trim() : undefined,
      }
    })
    const problema = problemaNasPerguntas(lista)
    if (problema) { setErro(problema); return }
    const perguntas = normalizarPerguntas(lista)!

    setSalvando(true)
    setErro(null)
    const db = createClient() as any
    const { data, error } = await db.from('social_briefings')
      .update({ perguntas }).eq('id', briefing.id).eq('status', 'enviado').select('id')
    if (!error && !data?.length) { setSalvando(false); setErro('O cliente acabou de responder este briefing. As perguntas não podem mais mudar.'); return }
    if (!error && comoPadrao) {
      const r = await db.from('briefing_modelos').upsert({ modelo: briefing.modelo, perguntas, updated_at: new Date().toISOString() })
      if (r.error) { setSalvando(false); setErro(ERROS_SEM_COLUNA.includes(r.error.code) ? ERRO_MIGRATION_PERGUNTAS : r.error.message); return }
    }
    setSalvando(false)
    if (error) { setErro(ERROS_SEM_COLUNA.includes(error.code) ? ERRO_MIGRATION_PERGUNTAS : error.message); return }
    onSalvo()
    onClose()
  }

  const etapas = [...new Set(itens.map((i) => i.etapa.trim()).filter(Boolean))]

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Perguntas do briefing · {nomeCliente}</DialogTitle>
          <DialogDescription>
            Vale só para este briefing. O link continua o mesmo: quem abrir depois de salvar já vê as perguntas novas.
          </DialogDescription>
        </DialogHeader>

        <datalist id="etapas-briefing">{etapas.map((e) => <option key={e} value={e} />)}</datalist>

        <div className="space-y-2">
          {itens.map((item, i) => {
            const etapaNova = i === 0 || itens[i - 1].etapa.trim() !== item.etapa.trim()
            return (
              <div key={item._id}>
                {etapaNova && <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-brand-lima/80">{item.etapa.trim() || 'Sem etapa'}</p>}
                <div className="space-y-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-5 text-xs text-brand-lavanda/30">{i + 1}</span>
                    <Input className="min-w-0 flex-1 basis-56" placeholder="Texto da pergunta" value={item.rotulo}
                      onChange={(e) => mudar(item._id, { rotulo: e.target.value })} />
                    <select className={cn(campo, 'w-48')} value={item.tipo} onChange={(e) => mudar(item._id, { tipo: e.target.value as TipoPergunta })}>
                      {(Object.entries(TIPOS_PERGUNTA) as [TipoPergunta, string][]).map(([k, l]) => <option key={k} value={k} className="bg-brand-noite">{l}</option>)}
                    </select>
                    <div className="flex">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mover(i, 1)} disabled={i === itens.length - 1} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-brand-rosa" onClick={() => remover(item._id)} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-7">
                    <input list="etapas-briefing" className={cn(campo, 'w-44')} placeholder="Etapa" value={item.etapa}
                      onChange={(e) => mudar(item._id, { etapa: e.target.value })} />
                    <label className="flex items-center gap-1.5 text-xs text-brand-lavanda/70">
                      <input type="checkbox" className="accent-[#B8F000]" checked={item.obrigatoria} onChange={(e) => mudar(item._id, { obrigatoria: e.target.checked })} /> Obrigatória
                    </label>
                    <input className={cn(campo, 'min-w-0 flex-1 basis-48')} placeholder="Dica embaixo do campo (opcional)" value={item.ajuda ?? ''}
                      onChange={(e) => mudar(item._id, { ajuda: e.target.value })} />
                  </div>
                  <div className="pl-7">
                    {temOpcoes(item.tipo) ? (
                      <Textarea rows={3} className="text-sm" placeholder={'Opções, uma por linha\nEx.: Sim\nNão'} value={item._opcoes}
                        onChange={(e) => mudar(item._id, { _opcoes: e.target.value })} />
                    ) : item.tipo !== 'telefone' && (
                      <input className={cn(campo, 'w-full')} placeholder="Exemplo dentro do campo (opcional)" value={item.placeholder ?? ''}
                        onChange={(e) => mudar(item._id, { placeholder: e.target.value })} />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={fimRef}>
            <Button variant="outline" size="sm" className="mt-2" onClick={adicionar}><Plus className="h-3.5 w-3.5" /> Adicionar pergunta</Button>
          </div>
        </div>

        <div className="space-y-3 border-t border-white/[0.06] pt-3">
          <label className="flex items-start gap-2 text-sm text-brand-lavanda/80">
            <input type="checkbox" className="mt-1 accent-[#B8F000]" checked={comoPadrao} onChange={(e) => setComoPadrao(e.target.checked)} />
            <span>Usar também como padrão nos próximos briefings de <b>{modelo.label}</b><span className="block text-xs text-brand-lavanda/40">Os briefings já gerados de outros clientes não mudam.</span></span>
          </label>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button size="sm" variant="ghost" onClick={() => restaurar('salvo')}><RotateCcw className="h-3.5 w-3.5" /> Voltar ao padrão</Button>
            <Button size="sm" variant="ghost" onClick={() => restaurar('codigo')}>Voltar às perguntas originais do sistema</Button>
          </div>
          {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar perguntas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

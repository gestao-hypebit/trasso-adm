'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { aprovarProposta, recusarProposta } from '@/app/portal/[token]/actions'
import { cn } from '@/lib/utils'

type Acao = 'aprovar' | 'recusar'

// Aprovar / recusar na própria página da proposta. Mesmas ações do portal
// (registram data, IP e navegador e avisam a agência).
export function DecisaoProposta({ token, propostaId, numero, agenciaNome, compacto = false }: {
  token: string; propostaId: string; numero: string; agenciaNome: string; compacto?: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState<Acao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function confirmar() {
    if (!aberto) return
    setErro(null)
    startTransition(async () => {
      const r = aberto === 'aprovar' ? await aprovarProposta(token, propostaId) : await recusarProposta(token, propostaId)
      if (r.success) {
        setAberto(null)
        router.refresh()
      } else {
        setErro(r.error)
      }
    })
  }

  return (
    <>
      <div className={cn('flex items-center gap-3', compacto ? 'flex-row' : 'flex-col sm:flex-row')}>
        <button
          type="button"
          onClick={() => setAberto('aprovar')}
          className={cn(
            'pp-foco inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#A8F300] font-semibold text-[#1A0533] transition-transform hover:-translate-y-0.5 active:translate-y-0',
            compacto ? 'h-11 px-5 text-sm' : 'h-14 w-full px-8 text-base sm:w-auto',
          )}
        >
          <Check className="h-5 w-5" strokeWidth={2.5} />
          {compacto ? <><span className="sm:hidden">Aprovar</span><span className="hidden sm:inline">Aprovar proposta</span></> : 'Aprovar proposta'}
        </button>
        <button
          type="button"
          onClick={() => setAberto('recusar')}
          className={cn(
            'pp-foco inline-flex items-center justify-center rounded-full font-medium transition-colors',
            compacto ? 'h-11 px-3 text-sm text-current opacity-60 hover:opacity-100' : 'h-14 w-full border border-white/20 px-8 text-base opacity-70 hover:opacity-100 sm:w-auto',
          )}
        >
          Recusar
        </button>
      </div>

      <Dialog open={!!aberto} onOpenChange={(o) => !o && !pending && setAberto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{aberto === 'aprovar' ? `Aprovar a proposta ${numero}?` : `Recusar a proposta ${numero}?`}</DialogTitle>
            <DialogDescription>
              {aberto === 'aprovar'
                ? `Ao confirmar, você aprova o escopo e o investimento desta proposta e autoriza a ${agenciaNome} a preparar o contrato.`
                : `A ${agenciaNome} vai ser avisada. Se quiser ajustar escopo ou valor, dá para conversar antes de recusar.`}
            </DialogDescription>
          </DialogHeader>
          {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setAberto(null)} disabled={pending} className="pp-foco h-10 rounded-full px-5 text-sm text-brand-lavanda/70 hover:text-brand-lavanda">
              Voltar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={pending}
              className={cn(
                'pp-foco inline-flex h-10 min-w-[10rem] items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60',
                aberto === 'aprovar' ? 'bg-[#A8F300] text-[#1A0533]' : 'bg-brand-rosa text-white',
              )}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : aberto === 'aprovar' ? 'Confirmar aprovação' : 'Confirmar recusa'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

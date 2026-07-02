'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { aprovarProposta } from '@/app/portal/[token]/actions'

export function AprovarPropostaButton({ token, propostaId, numero }: { token: string; propostaId: string; numero: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    setErro(null)
    startTransition(async () => {
      const result = await aprovarProposta(token, propostaId)
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setErro(result.error)
      }
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CheckCircle2 className="h-4 w-4" />
        Aprovar Proposta
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar proposta {numero}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-brand-lavanda/70">
            Ao confirmar, você aprova esta proposta e autoriza a Trasso a dar sequência ao trabalho combinado.
          </p>
          {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

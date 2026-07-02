'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { recusarProposta } from '@/app/portal/[token]/actions'

export function RecusarPropostaButton({ token, propostaId, numero }: { token: string; propostaId: string; numero: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    setErro(null)
    startTransition(async () => {
      const result = await recusarProposta(token, propostaId)
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
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4" />
        Recusar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar proposta {numero}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-brand-lavanda/70">
            Tem certeza que deseja recusar esta proposta? Entre em contato com a Trasso caso queira negociar outros termos.
          </p>
          {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

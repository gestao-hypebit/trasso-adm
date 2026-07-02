'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileSignature, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { assinarContrato } from '@/app/portal/[token]/actions'

export function AssinarContratoButton({ token, contratoId, numero }: { token: string; contratoId: string; numero: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    setErro(null)
    startTransition(async () => {
      const result = await assinarContrato(token, contratoId, nome)
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
      <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
        <FileSignature className="h-4 w-4" />
        Assinar Contrato
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinar contrato {numero}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-brand-lavanda/70">
            Confirme seu nome completo abaixo para registrar a aceitação deste contrato. Fica registrado o horário, o nome informado e o dispositivo de acesso.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="nomeConfirmacao">Nome completo</Label>
            <Input id="nomeConfirmacao" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" />
          </div>
          {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={pending || nome.trim().length < 3}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar assinatura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

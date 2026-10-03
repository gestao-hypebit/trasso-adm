'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

// Apaga o cliente e tudo que é dele (função excluir_cliente no banco).
// Pede o nome digitado porque não tem volta.
export function ExcluirClienteDialog({ clienteId, nome, contagem }: {
  clienteId: string
  nome: string
  contagem: { projetos: number; propostas: number; contratos: number; lancamentos: number }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmacao, setConfirmacao] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function excluir() {
    setExcluindo(true)
    setErro(null)
    const { error } = await (createClient() as any).rpc('excluir_cliente', { p_cliente_id: clienteId })
    if (error) {
      setErro(error.code === 'PGRST202'
        ? 'A migration de exclusão de cliente ainda não foi aplicada no Supabase.'
        : `Não foi possível excluir: ${error.message}`)
      setExcluindo(false)
      return
    }
    router.push('/clientes')
  }

  const itens = [
    [contagem.projetos, 'projeto', 'projetos'],
    [contagem.propostas, 'proposta', 'propostas'],
    [contagem.contratos, 'contrato', 'contratos'],
    [contagem.lancamentos, 'lançamento financeiro', 'lançamentos financeiros'],
  ].filter(([n]) => Number(n) > 0) as [number, string, string][]

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-2 text-brand-rosa/70 hover:text-brand-rosa" onClick={() => { setConfirmacao(''); setErro(null); setOpen(true) }}>
        <Trash2 className="h-4 w-4" /> Excluir
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir {nome}?</DialogTitle>
            <DialogDescription>Isso não pode ser desfeito.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-brand-lavanda/80">
            {itens.length > 0 ? (
              <>
                <p>Também serão apagados:</p>
                <ul className="list-disc pl-5 text-brand-lavanda">
                  {itens.map(([n, um, varios]) => <li key={um}>{n} {n === 1 ? um : varios}</li>)}
                </ul>
                <p className="text-xs text-brand-lavanda/50">Junto vão tarefas, onboarding, entregas, interações e avaliações. Leads ligados a ele continuam no funil, só perdem o vínculo.</p>
              </>
            ) : (
              <p>O cliente não tem projetos, propostas, contratos nem lançamentos.</p>
            )}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="confirmar-nome">Digite <span className="font-semibold text-brand-lavanda">{nome}</span> para confirmar</Label>
              <Input id="confirmar-nome" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" />
            </div>
            {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={excluindo}>Cancelar</Button>
            <Button variant="destructive" onClick={excluir} disabled={excluindo || confirmacao.trim() !== nome.trim()}>
              {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

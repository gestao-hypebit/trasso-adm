'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

// Apaga o projeto (função excluir_projeto no banco). Os lançamentos do
// projeto podem ir junto ou ficar no financeiro sem projeto.
export function ExcluirProjetoDialog({ projetoId, nome }: { projetoId: string; nome: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [lancamentos, setLancamentos] = useState<number | null>(null)
  const [apagarLancamentos, setApagarLancamentos] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErro(null)
    ;(createClient() as any)
      .from('lancamentos')
      .select('id', { count: 'exact', head: true })
      .eq('projeto_id', projetoId)
      .then(({ count }: { count: number | null }) => setLancamentos(count ?? 0))
  }, [open, projetoId])

  async function excluir() {
    setExcluindo(true)
    setErro(null)
    const { error } = await (createClient() as any).rpc('excluir_projeto', { p_projeto_id: projetoId, p_apagar_lancamentos: apagarLancamentos })
    if (error) {
      setErro(error.code === 'PGRST202'
        ? 'A migration de exclusão ainda não foi aplicada no Supabase.'
        : `Não foi possível excluir: ${error.message}`)
      setExcluindo(false)
      return
    }
    router.push('/projetos')
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-2 text-brand-rosa/70 hover:text-brand-rosa" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" /> Excluir
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir {nome}?</DialogTitle>
            <DialogDescription>Apaga também as tarefas, horas, onboarding, entregas e avaliação do projeto. Não tem volta.</DialogDescription>
          </DialogHeader>
          {lancamentos !== null && lancamentos > 0 && (
            <label className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-sm text-brand-lavanda/80">
              <input type="checkbox" checked={apagarLancamentos} onChange={(e) => setApagarLancamentos(e.target.checked)} className="mt-1 accent-brand-lima" />
              <span>
                Apagar também os {lancamentos} lançamento{lancamentos === 1 ? '' : 's'} financeiro{lancamentos === 1 ? '' : 's'} deste projeto.
                <span className="block text-xs text-brand-lavanda/50">Desmarcado, eles continuam no financeiro, só sem projeto.</span>
              </span>
            </label>
          )}
          {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={excluindo}>Cancelar</Button>
            <Button variant="destructive" onClick={excluir} disabled={excluindo}>
              {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir projeto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

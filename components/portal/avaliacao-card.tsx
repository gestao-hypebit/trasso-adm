'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { responderAvaliacao } from '@/app/portal/[token]/actions'

export function AvaliacaoCard({ token, avaliacaoId, projetoNome, clienteNome, clienteEmpresa }: {
  token: string
  avaliacaoId: string
  projetoNome: string | null
  clienteNome: string
  clienteEmpresa: string | null
}) {
  const router = useRouter()
  const [nota, setNota] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [depoimento, setDepoimento] = useState('')
  const [autoriza, setAutoriza] = useState(true)
  const [nomeExibicao, setNomeExibicao] = useState(clienteNome)
  const [cargoEmpresa, setCargoEmpresa] = useState(clienteEmpresa ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [pendente, startTransition] = useTransition()

  function enviar() {
    if (nota === null) { setErro('Escolha uma nota de 0 a 10.'); return }
    setErro(null)
    startTransition(async () => {
      const r = await responderAvaliacao(token, avaliacaoId, { nota, comentario, depoimento, autorizaPublicar: autoriza, nomeExibicao, cargoEmpresa })
      if (r.success) {
        setEnviado(true)
        router.refresh()
      } else {
        setErro(r.error)
      }
    })
  }

  if (enviado) {
    return (
      <Card className="border-brand-lima/30">
        <CardContent className="p-6 text-center">
          <p className="text-lg font-bold text-brand-lima" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Obrigado pela avaliação!</p>
          <p className="text-sm text-brand-lavanda/60 mt-1">Sua opinião ajuda a gente a melhorar a cada projeto.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-brand-lima/30">
      <CardContent className="p-6 space-y-5">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-brand-lima"><Star className="h-3.5 w-3.5" /> Avaliação</p>
          <h3 className="text-lg font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Como foi trabalhar com a Slick{projetoNome ? ` em ${projetoNome}` : ''}?
          </h3>
        </div>

        <div>
          <p className="text-sm text-brand-lavanda/80 mb-2">De 0 a 10, quanto você recomendaria a Slick para um amigo ou colega?</p>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNota(n)}
                className={cn(
                  'h-10 rounded-lg border text-sm font-semibold transition-colors',
                  nota === n
                    ? n >= 9 ? 'border-brand-lima bg-brand-lima text-brand-noite' : n >= 7 ? 'border-yellow-400 bg-yellow-400 text-brand-noite' : 'border-brand-rosa bg-brand-rosa text-white'
                    : 'border-white/[0.1] text-brand-lavanda/70 hover:border-white/[0.3]'
                )}
              >{n}</button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-brand-lavanda/40">
            <span>Nada provável</span><span>Muito provável</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="av-comentario">O que poderíamos ter feito melhor? (opcional)</Label>
          <Textarea id="av-comentario" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="av-depoimento">Deixe um depoimento (opcional)</Label>
          <p className="text-xs text-brand-lavanda/40">Conte em poucas linhas como foi a experiência e o resultado.</p>
          <Textarea id="av-depoimento" rows={3} value={depoimento} onChange={(e) => setDepoimento(e.target.value)} />
        </div>

        {depoimento.trim() && (
          <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <label className="flex items-start gap-2 text-sm text-brand-lavanda/80">
              <input type="checkbox" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} className="mt-1 accent-brand-lima" />
              Autorizo a Slick a publicar este depoimento no site e em materiais de divulgação.
            </label>
            {autoriza && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="av-nome">Nome que aparece</Label>
                  <Input id="av-nome" value={nomeExibicao} onChange={(e) => setNomeExibicao(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="av-cargo">Cargo / empresa</Label>
                  <Input id="av-cargo" value={cargoEmpresa} onChange={(e) => setCargoEmpresa(e.target.value)} placeholder="Ex.: Sócia, Clínica Sorriso" />
                </div>
              </div>
            )}
          </div>
        )}

        {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
        <Button onClick={enviar} disabled={pendente}>
          {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar avaliação'}
        </Button>
      </CardContent>
    </Card>
  )
}

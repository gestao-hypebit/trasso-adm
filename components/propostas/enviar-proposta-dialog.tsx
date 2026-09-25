'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Copy, Check, Mail, MessageCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { whatsappUrl } from '@/lib/utils'

type ClienteEnvio = {
  id: string; nome: string; email: string | null; whatsapp: string | null; telefone: string | null
  portal_token: string; portal_ativo: boolean
}

interface Props {
  proposta: { id: string; numero: string; titulo: string; status: string; cliente_id?: string | null }
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnviada?: (status: string, enviadaEm: string) => void
}

export function EnviarPropostaDialog({ proposta, open, onOpenChange, onEnviada }: Props) {
  const [cliente, setCliente] = useState<ClienteEnvio | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const supabase = createClient() as any
    supabase.from('propostas')
      .select('clientes(id, nome, email, whatsapp, telefone, portal_token, portal_ativo)')
      .eq('id', proposta.id).single()
      .then(({ data }: { data: { clientes: ClienteEnvio | null } | null }) => {
        setCliente(data?.clientes ?? null)
        setLoading(false)
      })
  }, [open, proposta.id])

  const portalUrl = cliente && typeof window !== 'undefined' ? `${window.location.origin}/portal/${cliente.portal_token}` : ''
  const primeiroNome = cliente?.nome.split(' ')[0] ?? ''
  const mensagem = `Olá ${primeiroNome}! Sua proposta ${proposta.numero} — ${proposta.titulo} já está disponível. Você pode ver os detalhes e aprovar por aqui: ${portalUrl}`
  const waUrl = whatsappUrl(cliente?.whatsapp || cliente?.telefone, mensagem)
  const mailUrl = cliente?.email
    ? `mailto:${cliente.email}?subject=${encodeURIComponent(`Proposta ${proposta.numero} — ${proposta.titulo}`)}&body=${encodeURIComponent(mensagem)}`
    : null

  // Envio conta como "enviada" só se a proposta ainda era rascunho; não regride status posteriores.
  async function marcarEnviada() {
    if (proposta.status !== 'rascunho') return
    const enviadaEm = new Date().toISOString()
    const supabase = createClient() as any
    const { error } = await supabase.from('propostas').update({ status: 'enviada', enviada_em: enviadaEm }).eq('id', proposta.id)
    if (!error) onEnviada?.('enviada', enviadaEm)
  }

  async function handleCopiar() {
    await navigator.clipboard.writeText(portalUrl)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
    await marcarEnviada()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar proposta</DialogTitle>
          <DialogDescription>
            O cliente abre a proposta no portal e pode aprovar ou recusar online. Ao enviar, o status muda para &quot;Enviada&quot;.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-lavanda/40" /></div>
        ) : !cliente ? (
          <p className="text-sm text-brand-lavanda/60 py-4">Esta proposta não tem cliente vinculado. Edite a proposta e selecione um cliente.</p>
        ) : !cliente.portal_ativo ? (
          <div className="py-4 space-y-3">
            <div className="flex gap-2 text-sm text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              O portal de {cliente.nome} está desativado. Reative o acesso na ficha do cliente para enviar o link.
            </div>
            <Link href={`/clientes/${cliente.id}`}><Button size="sm" variant="outline">Abrir ficha do cliente</Button></Link>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-brand-lavanda/40 font-mono break-all rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">{portalUrl}</p>
            <div className="grid gap-2">
              {waUrl ? (
                <Button asChild variant="violeta" className="justify-start">
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={marcarEnviada}>
                    <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                  </a>
                </Button>
              ) : (
                <Button variant="violeta" className="justify-start" disabled><MessageCircle className="h-4 w-4" /> Cliente sem WhatsApp/telefone</Button>
              )}
              {mailUrl ? (
                <Button asChild variant="outline" className="justify-start">
                  <a href={mailUrl} onClick={marcarEnviada}>
                    <Mail className="h-4 w-4" /> Enviar por e-mail
                  </a>
                </Button>
              ) : (
                <Button variant="outline" className="justify-start" disabled><Mail className="h-4 w-4" /> Cliente sem e-mail</Button>
              )}
              <Button variant="outline" className="justify-start" onClick={handleCopiar}>
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado ? 'Link copiado' : 'Copiar link do portal'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

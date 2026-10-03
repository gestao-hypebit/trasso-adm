'use client'

import { useState } from 'react'
import { Copy, Check, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { whatsappUrl } from '@/lib/utils'

export type ClientePortal = {
  nome: string
  telefone: string | null
  whatsapp: string | null
  portal_token: string
  portal_ativo: boolean
}

// Copiar o link do portal ou mandar pelo WhatsApp com uma mensagem pronta.
export function PortalLinkAcoes({ cliente, mensagem }: { cliente: ClientePortal | null; mensagem: string }) {
  const [copiado, setCopiado] = useState(false)
  if (!cliente) return <p className="text-xs text-brand-lavanda/40">Projeto sem cliente vinculado.</p>
  if (!cliente.portal_ativo) return <p className="text-xs text-yellow-400">O portal deste cliente está desativado. Ative na página do cliente.</p>

  const url = `${window.location.origin}/portal/${cliente.portal_token}`
  const whatsapp = whatsappUrl(cliente.whatsapp ?? cliente.telefone, `Oi ${cliente.nome.split(' ')[0]}! ${mensagem}\n\n${url}`)

  async function copiar() {
    await navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={copiar}>
        {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiado ? 'Copiado' : 'Copiar link do portal'}
      </Button>
      {whatsapp && (
        <Button size="sm" asChild>
          <a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> Enviar no WhatsApp</a>
        </Button>
      )}
    </div>
  )
}

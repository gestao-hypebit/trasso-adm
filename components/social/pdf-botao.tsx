'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { slugify } from '@/lib/utils'
import type { Post } from '@/lib/social/tipos'

type Props = {
  cliente: string
  mes: string
  objetivo: string | null
  posts: Post[]
  logoUrl: string | null
  agenciaNome: string
  comAprovacao: boolean
}

// O PDF só é montado no clique: com as artes dos posts ele é pesado demais
// para refazer a cada edição na tela.
export function PdfBotao({ rotulo = 'Exportar PDF', ...doc }: Props & { rotulo?: string }) {
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState(false)

  async function baixar() {
    setGerando(true)
    setErro(false)
    try {
      const [{ pdf }, { PlanejamentoPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/social/planejamento-pdf'),
      ])
      const blob = await pdf(<PlanejamentoPDF {...doc} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `planejamento-${slugify(doc.cliente)}-${doc.mes.slice(0, 7)}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      console.error('[social] pdf', e)
      setErro(true)
    }
    setGerando(false)
  }

  return (
    <Button variant="outline" size="sm" onClick={baixar} disabled={gerando} title={erro ? 'Não deu para gerar o PDF. Tente de novo.' : undefined}>
      {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className={erro ? 'h-3.5 w-3.5 text-brand-rosa' : 'h-3.5 w-3.5'} />}
      {gerando ? 'Gerando…' : rotulo}
    </Button>
  )
}

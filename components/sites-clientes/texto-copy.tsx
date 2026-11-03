import { Fragment } from 'react'
import { cn } from '@/lib/utils'

// Mostra um texto da copy com as marcações aplicadas (sem HTML):
// *destaque*, **negrito**, ~apagado~; linha em branco separa parágrafos.
// Funciona no servidor e no navegador.

const MARCAS = /(\*\*[^*]+\*\*|\*[^*]+\*|~[^~]+~)/g

function Linha({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(MARCAS).filter(Boolean).map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i} className="font-semibold text-brand-lavanda">{p.slice(2, -2)}</strong>
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <mark key={i} className="rounded-[3px] bg-brand-lima/90 px-1 text-brand-noite">{p.slice(1, -1)}</mark>
        if (p.startsWith('~') && p.endsWith('~') && p.length > 2) return <span key={i} className="opacity-50">{p.slice(1, -1)}</span>
        return <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}

export function TextoCopy({ texto, className }: { texto: string; className?: string }) {
  const paragrafos = texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <div className={cn('space-y-3', className)}>
      {paragrafos.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          <Linha texto={p} />
        </p>
      ))}
    </div>
  )
}

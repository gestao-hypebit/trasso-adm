import { AlertTriangle } from 'lucide-react'

export default function PortalNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-brand-rosa/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-brand-rosa" />
        </div>
        <h1 className="text-lg font-bold text-brand-lavanda mb-2">Link inválido ou expirado</h1>
        <p className="text-sm text-brand-lavanda/50">
          Este link de acesso não existe mais ou foi revogado. Fale com o seu contato na Trasso para receber um novo link.
        </p>
      </div>
    </div>
  )
}

export function PortalHeader({ clienteNome, clienteEmpresa }: { clienteNome: string; clienteEmpresa: string | null }) {
  return (
    <header className="border-b border-white/[0.06] bg-brand-noite/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-white/[0.07] border border-white/[0.1] flex items-center justify-center text-brand-lima font-bold text-sm">T</div>
          <div>
            <p className="font-bold text-brand-lavanda text-sm leading-none">trasso</p>
            <p className="text-[10px] text-brand-lavanda/40 mt-0.5">Portal do Cliente</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-brand-lavanda leading-none">{clienteNome}</p>
          {clienteEmpresa && <p className="text-xs text-brand-lavanda/40 mt-1">{clienteEmpresa}</p>}
        </div>
      </div>
    </header>
  )
}

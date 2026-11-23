// Tela cheia simples para os links públicos (/plano) quando não há o que mostrar.
export function AvisoPublico({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-brand-noite p-6 text-center">
      <div>
        <p className="mb-2 text-xl font-semibold text-brand-lavanda">{titulo}</p>
        <p className="text-brand-lavanda/60">{texto}</p>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getClienteByToken, registrarAcessoPortal } from '@/lib/portal/auth'
import { PortalHeader } from '@/components/portal/portal-header'

export const metadata: Metadata = {
  title: 'Portal do Cliente — Trasso',
  robots: { index: false, follow: false },
}

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const cliente = await getClienteByToken(token)
  if (!cliente) notFound()

  await registrarAcessoPortal(cliente.id)

  return (
    <div className="min-h-screen bg-brand-noite">
      <PortalHeader clienteNome={cliente.nome} clienteEmpresa={cliente.empresa} />
      <main className="max-w-5xl mx-auto p-6">{children}</main>
    </div>
  )
}

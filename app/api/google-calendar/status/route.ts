import { NextResponse } from 'next/server'
import { getConnectionStatus } from '@/lib/google-calendar'
import { usuarioLogado } from '@/lib/asaas/auth'

export async function GET() {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const status = await getConnectionStatus()
  return NextResponse.json(status)
}

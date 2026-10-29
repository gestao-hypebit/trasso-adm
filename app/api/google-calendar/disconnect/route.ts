import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { usuarioLogado } from '@/lib/asaas/auth'

export async function DELETE() {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  await (supabase as any)
    .from('integracoes')
    .delete()
    .eq('tipo', 'google_calendar')

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE() {
  const supabase = createServiceClient()
  await (supabase as any)
    .from('integracoes')
    .delete()
    .eq('tipo', 'google_calendar')

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { gerarComissoesDoMes } from '@/lib/comissoes/gerar'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await gerarComissoesDoMes(createServiceClient(), new Date())
  return NextResponse.json(result)
}

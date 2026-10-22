import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { usuarioLogado } from '@/lib/asaas/auth'
import { acompanharAssinaturas } from '@/lib/automacoes/assinaturas'
import { reguaDeCobranca } from '@/lib/automacoes/cobranca'

// Automações diárias (vercel.json): assinaturas do Asaas → Metas e avisos, e a
// régua de cobrança. Também roda pelo botão "Rodar agora" na tela do Asaas.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const doCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!doCron && !(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createServiceClient() as any
  const [assinaturas, cobranca] = await Promise.allSettled([acompanharAssinaturas(supabase), reguaDeCobranca(supabase)])
  const valor = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : { erro: String(r.reason?.message ?? r.reason) })
  if (assinaturas.status === 'rejected') console.error('[cron] assinaturas', assinaturas.reason)
  if (cobranca.status === 'rejected') console.error('[cron] cobranca', cobranca.reason)
  return NextResponse.json({ assinaturas: valor(assinaturas), cobranca: valor(cobranca) })
}

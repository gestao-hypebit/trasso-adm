import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { usuarioLogado } from '@/lib/asaas/auth'
import { metaConfigurado } from '@/lib/anuncios/meta'
import { sincronizarTudo } from '@/lib/anuncios/sincronizar'

// Sincronização diária dos anúncios (vercel.json). Também roda pelo botão
// "Atualizar agora" em /anuncios/configuracoes. Só lê do Meta.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const doCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!doCron && !(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!metaConfigurado()) return NextResponse.json({ error: 'META_ACCESS_TOKEN não configurado no servidor.' }, { status: 400 })

  try {
    const resultados = await sincronizarTudo(createServiceClient() as any, doCron ? 'cron' : 'manual', maxDuration * 1000)
    return NextResponse.json({ resultados })
  } catch (e) {
    console.error('[anuncios] cron', e instanceof Error ? e.message : 'erro')
    return NextResponse.json({ error: 'Não foi possível sincronizar agora.' }, { status: 500 })
  }
}

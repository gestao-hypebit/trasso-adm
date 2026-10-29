import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createOAuth2Client } from '@/lib/google-calendar'
import { createServiceClient } from '@/lib/supabase/service'
import { usuarioLogado } from '@/lib/asaas/auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state')

  const base = new URL(request.url).origin
  const falhou = () => {
    const res = NextResponse.redirect(`${base}/configuracoes?tab=integracoes&gcal=error`)
    res.cookies.delete({ name: 'gcal_state', path: '/api/google-calendar' })
    return res
  }

  const stateEsperado = request.cookies.get('gcal_state')?.value
  if (error || !code || !state || state !== stateEsperado || !(await usuarioLogado())) return falhou()

  try {
    const oauth2 = createOAuth2Client()
    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
    const { data: userInfo } = await oauth2Api.userinfo.get()

    const supabase = createServiceClient()
    const { error: erroDb } = await (supabase as any)
      .from('integracoes')
      .upsert({
        tipo: 'google_calendar',
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? null,
        token_expiry: tokens.expiry_date ?? null,
        email: userInfo.email ?? null,
      }, { onConflict: 'tipo' })
    if (erroDb) throw new Error(erroDb.message)
  } catch (e) {
    console.error('[google-calendar] callback', e instanceof Error ? e.message : e)
    return falhou()
  }

  const res = NextResponse.redirect(`${base}/configuracoes?tab=integracoes&gcal=connected`)
  res.cookies.delete({ name: 'gcal_state', path: '/api/google-calendar' })
  return res
}

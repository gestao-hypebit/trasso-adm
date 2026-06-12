import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createOAuth2Client } from '@/lib/google-calendar'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const base = new URL(request.url).origin

  if (error || !code) {
    return NextResponse.redirect(`${base}/configuracoes?tab=integracoes&gcal=error`)
  }

  const oauth2 = createOAuth2Client()
  const { tokens } = await oauth2.getToken(code)
  oauth2.setCredentials(tokens)

  const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
  const { data: userInfo } = await oauth2Api.userinfo.get()

  const supabase = createServiceClient()
  await (supabase as any)
    .from('integracoes')
    .upsert({
      tipo: 'google_calendar',
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry: tokens.expiry_date ?? null,
      email: userInfo.email ?? null,
    }, { onConflict: 'tipo' })

  return NextResponse.redirect(`${base}/configuracoes?tab=integracoes&gcal=connected`)
}

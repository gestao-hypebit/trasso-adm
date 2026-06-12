import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

export function getAuthUrl() {
  const oauth2 = createOAuth2Client()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  })
}

type IntegracaoRow = {
  tipo: string
  access_token: string | null
  refresh_token: string | null
  token_expiry: number | null
  email: string | null
}

export async function getAuthenticatedClient() {
  const supabase = createServiceClient()
  const { data } = await (supabase as any)
    .from('integracoes')
    .select('access_token, refresh_token, token_expiry, email')
    .eq('tipo', 'google_calendar')
    .single()

  if (!data?.refresh_token) return null

  const oauth2 = createOAuth2Client()
  oauth2.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.token_expiry,
  })

  // Auto-refresh if expired or expiring within 5 minutes
  if (!data.token_expiry || data.token_expiry < Date.now() + 5 * 60 * 1000) {
    const { credentials } = await oauth2.refreshAccessToken()
    oauth2.setCredentials(credentials)
    await (supabase as any)
      .from('integracoes')
      .update({
        access_token: credentials.access_token,
        token_expiry: credentials.expiry_date ?? null,
      })
      .eq('tipo', 'google_calendar')
  }

  return oauth2
}

export async function getConnectionStatus(): Promise<{ connected: boolean; email: string | null }> {
  const supabase = createServiceClient()
  const { data } = await (supabase as any)
    .from('integracoes')
    .select('email, refresh_token')
    .eq('tipo', 'google_calendar')
    .single()

  return {
    connected: !!data?.refresh_token,
    email: data?.email ?? null,
  }
}

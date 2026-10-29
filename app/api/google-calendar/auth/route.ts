import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google-calendar'
import { usuarioLogado } from '@/lib/asaas/auth'

export async function GET(request: NextRequest) {
  if (!(await usuarioLogado())) return NextResponse.redirect(new URL('/login', request.url))

  // O callback só aceita a volta do Google com este mesmo state.
  const state = randomBytes(16).toString('hex')
  const res = NextResponse.redirect(getAuthUrl(state))
  res.cookies.set('gcal_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/google-calendar' })
  return res
}

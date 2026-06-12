import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/google-calendar'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedClient()
  if (!auth) return NextResponse.json({ events: [] })

  const { searchParams } = new URL(request.url)
  const timeMin = searchParams.get('timeMin') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = searchParams.get('timeMax') ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  const calendar = google.calendar({ version: 'v3', auth })
  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  })

  const events = (data.items ?? []).map((e) => ({
    id: `gcal_${e.id}`,
    gcal_id: e.id,
    titulo: e.summary ?? '(sem título)',
    data_inicio: e.start?.dateTime ?? e.start?.date ?? '',
    data_fim: e.end?.dateTime ?? e.end?.date ?? null,
    link_meet: e.hangoutLink ?? (e.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ?? null),
    tipo: 'gcal',
    clientes: null,
    descricao: e.description ?? null,
  }))

  return NextResponse.json({ events })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedClient()
  if (!auth) return NextResponse.json({ error: 'Google Calendar não conectado' }, { status: 401 })

  const body = await request.json()
  const calendar = google.calendar({ version: 'v3', auth })

  const resource: any = {
    summary: body.titulo,
    description: body.descricao ?? undefined,
    start: { dateTime: body.data_inicio, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: body.data_fim ?? body.data_inicio, timeZone: 'America/Sao_Paulo' },
  }

  if (body.link_meet) {
    resource.conferenceData = {
      createRequest: { requestId: `trasso-${Date.now()}` },
    }
  }

  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: resource,
    conferenceDataVersion: body.link_meet ? 1 : 0,
  })

  return NextResponse.json({ gcal_id: data.id, link_meet: data.hangoutLink ?? null })
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedClient()
  if (!auth) return NextResponse.json({ error: 'Google Calendar não conectado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const gcalId = searchParams.get('id')
  if (!gcalId) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const calendar = google.calendar({ version: 'v3', auth })
  await calendar.events.delete({ calendarId: 'primary', eventId: gcalId })

  return NextResponse.json({ ok: true })
}

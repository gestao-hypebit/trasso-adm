import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/google-calendar'
import { usuarioLogado } from '@/lib/asaas/auth'
import { createServiceClient } from '@/lib/supabase/service'

const naoAutorizado = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 })
const UMA_HORA = 60 * 60 * 1000

export async function GET(request: NextRequest) {
  if (!(await usuarioLogado())) return naoAutorizado()

  try {
    const auth = await getAuthenticatedClient()
    if (!auth) return NextResponse.json({ events: [] })

    const { searchParams } = new URL(request.url)
    const timeMin = searchParams.get('timeMin') ?? new Date(Date.now() - 30 * 24 * UMA_HORA).toISOString()
    const timeMax = searchParams.get('timeMax') ?? new Date(Date.now() + 90 * 24 * UMA_HORA).toISOString()

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
      // Dia inteiro vem só com a data: sem horário/fuso, para não cair no dia anterior no Brasil.
      data_inicio: e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00` : ''),
      data_fim: e.end?.dateTime ?? null,
      dia_inteiro: !e.start?.dateTime,
      link_meet: e.hangoutLink ?? (e.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ?? null),
      link_google: e.htmlLink ?? null,
      tipo: 'gcal',
      clientes: null,
      descricao: e.description ?? null,
    }))

    return NextResponse.json({ events })
  } catch (e) {
    console.error('[google-calendar] listar', e instanceof Error ? e.message : e)
    return NextResponse.json({ events: [], error: 'Não foi possível ler o Google Agenda. Tente reconectar em Configurações → Integrações.' })
  }
}

// Envia um evento da agenda da Slick para o Google e guarda o id (e o Meet) nele.
export async function POST(request: NextRequest) {
  if (!(await usuarioLogado())) return naoAutorizado()

  const auth = await getAuthenticatedClient().catch(() => null)
  if (!auth) return NextResponse.json({ error: 'Google Agenda não conectado' }, { status: 400 })

  const body = await request.json() as { evento_id?: string; gerar_meet?: boolean }
  if (!body.evento_id) return NextResponse.json({ error: 'evento_id obrigatório' }, { status: 400 })

  const supabase = createServiceClient() as any
  const { data: evento } = await supabase
    .from('eventos')
    .select('id, titulo, descricao, data_inicio, data_fim, link_meet, clientes(nome)')
    .eq('id', body.evento_id)
    .single()
  if (!evento) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  const inicio = new Date(evento.data_inicio)
  const fim = evento.data_fim ? new Date(evento.data_fim) : new Date(inicio.getTime() + UMA_HORA)
  const descricao = [evento.clientes?.nome && `Cliente: ${evento.clientes.nome}`, evento.link_meet && `Link: ${evento.link_meet}`, evento.descricao]
    .filter(Boolean).join('\n\n')

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: body.gerar_meet ? 1 : 0,
      requestBody: {
        summary: evento.titulo,
        description: descricao || undefined,
        start: { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: fim.toISOString(), timeZone: 'America/Sao_Paulo' },
        ...(body.gerar_meet ? { conferenceData: { createRequest: { requestId: `slick-${evento.id}` } } } : {}),
      },
    })

    const linkMeet = evento.link_meet ?? data.hangoutLink ?? null
    await supabase.from('eventos').update({ google_event_id: data.id, link_meet: linkMeet }).eq('id', evento.id)
    return NextResponse.json({ gcal_id: data.id, link_meet: linkMeet })
  } catch (e) {
    console.error('[google-calendar] criar', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'O evento foi salvo na Slick, mas não no Google Agenda.' }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await usuarioLogado())) return naoAutorizado()

  const auth = await getAuthenticatedClient().catch(() => null)
  if (!auth) return NextResponse.json({ error: 'Google Agenda não conectado' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const gcalId = searchParams.get('id')
  if (!gcalId) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    await calendar.events.delete({ calendarId: 'primary', eventId: gcalId })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[google-calendar] apagar', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Não foi possível apagar no Google Agenda.' }, { status: 502 })
  }
}

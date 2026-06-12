import { NextResponse } from 'next/server'
import { getConnectionStatus } from '@/lib/google-calendar'

export async function GET() {
  const status = await getConnectionStatus()
  return NextResponse.json(status)
}

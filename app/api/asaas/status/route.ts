import { NextResponse } from 'next/server'
import { usuarioLogado } from '@/lib/asaas/auth'
import { asaasConfigurado } from '@/lib/asaas/api'

// O painel não enxerga variáveis de ambiente: esta rota diz o que está configurado.
export async function GET() {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({
    chave: asaasConfigurado(),
    webhookToken: !!process.env.ASAAS_WEBHOOK_TOKEN,
    ambiente: process.env.ASAAS_AMBIENTE === 'sandbox' ? 'sandbox' : 'producao',
  })
}

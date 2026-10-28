import { NextResponse } from 'next/server'
import { asaasConfigurado } from '@/lib/asaas/api'
import { buscarAssinaturasAsaas } from '@/lib/asaas/assinaturas'
import { usuarioLogado } from '@/lib/asaas/auth'

// Assinaturas do Asaas com o nome/contato do cliente de cada uma.
// A tela do Catálogo Place liga cada assinatura ao cliente do sistema
// pelo clientes.asaas_customer_id.
export async function GET() {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!asaasConfigurado()) return NextResponse.json({ configurado: false, assinaturas: [] })

  try {
    return NextResponse.json({ configurado: true, assinaturas: await buscarAssinaturasAsaas() })
  } catch (e) {
    console.error('[asaas] assinaturas', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao falar com o Asaas.' }, { status: 502 })
  }
}

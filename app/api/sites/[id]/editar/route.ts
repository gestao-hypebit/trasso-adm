import { NextRequest, NextResponse } from 'next/server'
import { editarHtml } from '@/lib/sites/ia'
import { abrirPrevia, respostaErro, salvarVersao } from '@/lib/sites/servidor'

export const maxDuration = 300

// Ajuste por conversa: { instrucao } → aplica a alteração e salva como versão nova.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { instrucao } = (await req.json().catch(() => ({}))) as { instrucao?: unknown }
  if (typeof instrucao !== 'string' || !instrucao.trim()) return NextResponse.json({ error: 'Descreva o que alterar.' }, { status: 400 })

  const r = await abrirPrevia(id)
  if ('erro' in r) return r.erro
  if (!r.previa.html) return NextResponse.json({ error: 'Gere o site antes de pedir ajustes.' }, { status: 400 })

  try {
    const { html, resumo } = await editarHtml(r.previa.html, instrucao.trim(), r.previa.briefing)
    const numero = await salvarVersao(r.supabase, r.previa, html, instrucao.trim())
    return NextResponse.json({ resumo, versao: numero })
  } catch (e) {
    return respostaErro(e, 'editar')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { gerarConteudo } from '@/lib/sites/ia'
import { abrirPrevia, respostaErro } from '@/lib/sites/servidor'

export const maxDuration = 300

// Etapa 1: a IA escreve os textos do site a partir do briefing.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await abrirPrevia(id)
  if ('erro' in r) return r.erro

  try {
    const conteudo = await gerarConteudo(r.previa.briefing)
    const { error } = await r.supabase
      .from('site_previas')
      .update({ conteudo, status: r.previa.html ? r.previa.status : 'conteudo', erro: null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ conteudo })
  } catch (e) {
    return respostaErro(e, 'conteudo')
  }
}

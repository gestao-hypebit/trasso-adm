import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { usuarioLogado } from '@/lib/asaas/auth'
import { iaConfigurada } from '@/lib/sites/ia'
import { respostaErro } from '@/lib/sites/servidor'
import { sugerirPauta } from '@/lib/social/ia'
import { FORMATOS, REDES, fimDoPeriodo } from '@/lib/social/tipos'

export const maxDuration = 300

// A IA sugere a pauta do período. Não grava nada: a tela mostra as sugestões e
// você escolhe quais entram no calendário.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!iaConfigurada()) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 400 })

  const { id } = await params
  const corpo = await req.json().catch(() => ({}))
  const quantidade = Math.min(Math.max(Number(corpo.quantidade) || 12, 1), 31)
  const formatos = (Array.isArray(corpo.formatos) ? corpo.formatos : []).filter((f: string) => f in FORMATOS)
  const redes = (Array.isArray(corpo.redes) ? corpo.redes : []).filter((r: string) => r in REDES)
  const contexto = String(corpo.contexto ?? '').slice(0, 4000)

  const supabase = createServiceClient() as any
  const { data: plano } = await supabase
    .from('social_planejamentos')
    .select('id, mes, data_fim, objetivo, clientes(nome, empresa, segmento, cidade, observacoes), social_posts(data, titulo)')
    .eq('id', id)
    .maybeSingle()
  if (!plano) return NextResponse.json({ error: 'Planejamento não encontrado.' }, { status: 404 })

  try {
    const pauta = await sugerirPauta({
      mes: plano.mes,
      fim: fimDoPeriodo(plano.mes, plano.data_fim),
      quantidade,
      formatos: formatos.length ? formatos : ['feed', 'carrossel', 'reels', 'stories'],
      redes: redes.length ? redes : ['instagram'],
      cliente: plano.clientes,
      objetivo: plano.objetivo,
      contexto,
      existentes: plano.social_posts ?? [],
    })
    // Descarta datas fora do período (a IA às vezes escorrega no último dia).
    const fim = fimDoPeriodo(plano.mes, plano.data_fim)
    return NextResponse.json({ posts: pauta.posts.filter((p) => p.data >= plano.mes && p.data <= fim) })
  } catch (e) {
    return respostaErro(e, 'social/sugerir')
  }
}

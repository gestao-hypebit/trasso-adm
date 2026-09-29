import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validarRespostas, type Campo } from '@/lib/leads/formulario'

// Rotas chamadas pelo servidor do SITE (nunca pelo navegador do visitante).
// GET  → definição do formulário para o site renderizar.
// POST → recebe as respostas, valida e grava o lead.

function autorizado(req: NextRequest) {
  const esperado = process.env.LEADS_API_KEY
  const recebido = req.headers.get('x-api-key')
  if (!esperado || !recebido) return false
  const a = Buffer.from(esperado)
  const b = Buffer.from(recebido)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function buscarFormulario(slug: string) {
  const supabase = createServiceClient() as any
  const { data, error } = await supabase
    .from('formularios')
    .select('id, slug, titulo, subtitulo, botao_texto, mensagem_sucesso, campos')
    .eq('slug', slug)
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw error
  return { supabase, formulario: data as { id: string; slug: string; titulo: string | null; subtitulo: string | null; botao_texto: string; mensagem_sucesso: string; campos: Campo[] } | null }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!autorizado(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { slug } = await params
  try {
    const { formulario } = await buscarFormulario(slug)
    if (!formulario) return NextResponse.json({ error: 'Formulário não encontrado.' }, { status: 404 })

    const { id: _id, ...publico } = formulario
    return NextResponse.json(publico)
  } catch (e) {
    console.error('[leads] formulario', e)
    return NextResponse.json({ error: 'Não foi possível carregar o formulário.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!autorizado(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { slug } = await params
  let body: { valores?: Record<string, unknown>; pagina?: string; origem?: string; utm?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  try {
    const { supabase, formulario } = await buscarFormulario(slug)
    if (!formulario) return NextResponse.json({ error: 'Formulário não encontrado.' }, { status: 404 })

    const resultado = validarRespostas(formulario.campos ?? [], body.valores ?? {})
    if (!resultado.ok) return NextResponse.json({ error: 'Confere os campos destacados.', erros: resultado.erros }, { status: 422 })

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        formulario_id: formulario.id,
        ...resultado.lead,
        respostas: resultado.respostas,
        // Ex.: "landing-site" para os leads dos anúncios. Só slug simples.
        origem: body.origem?.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50) || 'site',
        pagina: body.pagina?.slice(0, 500) ?? null,
        utm: body.utm && Object.keys(body.utm).length > 0 ? body.utm : null,
      })
      .select('id')
      .single()
    if (error) throw error

    // Aviso no sino do header. Não pode derrubar o recebimento do lead.
    try {
      await supabase.from('notificacoes').insert({
        usuario_id: null,
        titulo: 'Novo lead pelo site 🎯',
        mensagem: resultado.lead.empresa ? `${resultado.lead.nome} · ${resultado.lead.empresa}` : resultado.lead.nome,
        link: `/leads?lead=${lead.id}`,
        tipo: 'info',
        lida: false,
      })
    } catch (e) {
      console.error('[leads] notificar', e)
    }

    return NextResponse.json({ ok: true, mensagem: formulario.mensagem_sucesso }, { status: 201 })
  } catch (e) {
    console.error('[leads] receber', e)
    return NextResponse.json({ error: 'Não foi possível registrar agora.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashChave, PREFIXO_CHAVE } from '@/lib/sites-clientes/chave'

// Conteúdo publicado de um site de cliente. Chamada pelo servidor do site
// (com cache e tag; ver docs/sites-clientes.md), header x-site-key.
// Sem nada publicado ainda, devolve conteudo: null e o site usa os padrões dele.

export async function GET(req: NextRequest) {
  const chave = req.headers.get('x-site-key')?.trim()
  if (!chave || !chave.startsWith(PREFIXO_CHAVE) || chave.length > 100) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient() as any
    const { data: site } = await supabase.from('sites_clientes').select('id, ativo').eq('chave_hash', await hashChave(chave)).maybeSingle()
    if (!site) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data } = await supabase.from('site_conteudos').select('publicado, publicado_em').eq('site_id', site.id).maybeSingle()
    return NextResponse.json(
      { conteudo: data?.publicado ?? null, publicado_em: data?.publicado_em ?? null },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('[sites] conteudo', e)
    return NextResponse.json({ error: 'Não foi possível carregar.' }, { status: 500 })
  }
}

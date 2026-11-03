import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashChave, PREFIXO_CHAVE } from '@/lib/sites-clientes/chave'
import { validarSiteLead, type SiteLeadPayload } from '@/lib/sites-clientes/leads'
import { normalizarUtm } from '@/lib/leads/utm'

// Recebe os leads dos sites dos clientes.
// Chamada pelo SERVIDOR do site (server action / route handler), nunca pelo
// navegador do visitante: a chave do site (header x-site-key) não pode ir
// para o front, senão qualquer um envia leads em nome do site.

export async function POST(req: NextRequest) {
  const chave = req.headers.get('x-site-key')?.trim()
  if (!chave || !chave.startsWith(PREFIXO_CHAVE) || chave.length > 100) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: SiteLeadPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })

  try {
    const supabase = createServiceClient() as any
    const { data: site, error: erroSite } = await supabase
      .from('sites_clientes')
      .select('id, ativo')
      .eq('chave_hash', await hashChave(chave))
      .maybeSingle()
    if (erroSite) throw erroSite
    if (!site) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!site.ativo) return NextResponse.json({ error: 'Site desativado.' }, { status: 403 })

    const resultado = validarSiteLead(body)
    if (!resultado.ok) return NextResponse.json({ error: 'Confere os campos destacados.', erros: resultado.erros }, { status: 422 })

    // Robô caiu na armadilha: responde como sucesso e não grava.
    if (resultado.spam) return NextResponse.json({ ok: true }, { status: 201 })

    const utm = normalizarUtm(body.utm)
    const { error } = await supabase.from('site_leads').insert({
      site_id: site.id,
      ...resultado.lead,
      utm: Object.keys(utm).length > 0 ? utm : null,
    })
    if (error) throw error

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    console.error('[sites] receber lead', e)
    return NextResponse.json({ error: 'Não foi possível registrar agora.' }, { status: 500 })
  }
}

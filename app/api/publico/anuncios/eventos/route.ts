import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { eventoSchema, hashChave, paraLinha } from '@/lib/anuncios/eventos'

// Eventos de funil enviados pelo SERVIDOR de cada marca (nunca pelo navegador).
// Header x-api-key: chave da marca (gerada em /anuncios/configuracoes).
// Corpo: um evento ou { eventos: [...] } com até 100.
// Reenviar o mesmo evento_id não duplica.
//
// Nada do corpo vai para o log: só contagens e mensagens de validação.

const MAX_EVENTOS = 100

export async function POST(req: NextRequest) {
  const chave = req.headers.get('x-api-key')
  if (!chave || chave.length < 20 || chave.length > 200) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createServiceClient() as any
  const { data: marca, error: erroMarca } = await supabase
    .from('anuncio_marcas')
    .select('id, slug')
    .eq('api_key_hash', hashChave(chave))
    .maybeSingle()
  if (erroMarca) {
    console.error('[anuncios] eventos: falha ao validar chave')
    return NextResponse.json({ error: 'Não foi possível registrar agora.' }, { status: 500 })
  }
  if (!marca) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  const lista = Array.isArray((body as { eventos?: unknown })?.eventos) ? (body as { eventos: unknown[] }).eventos : [body]
  if (lista.length === 0 || lista.length > MAX_EVENTOS) {
    return NextResponse.json({ error: `Envie de 1 a ${MAX_EVENTOS} eventos.` }, { status: 400 })
  }

  const linhas = []
  const erros: { indice: number; campo: string; mensagem: string }[] = []
  for (const [indice, bruto] of lista.entries()) {
    const r = eventoSchema.safeParse(bruto)
    if (!r.success) {
      for (const i of r.error.issues) erros.push({ indice, campo: i.path.join('.'), mensagem: i.message })
      continue
    }
    if (r.data.marca !== marca.slug) {
      erros.push({ indice, campo: 'marca', mensagem: `a chave enviada é da marca "${marca.slug}"` })
      continue
    }
    linhas.push(paraLinha(r.data, marca.id))
  }
  if (erros.some((e) => e.campo === 'marca')) return NextResponse.json({ error: 'Marca não confere com a chave.', erros }, { status: 403 })
  if (erros.length) return NextResponse.json({ error: 'Eventos inválidos.', erros }, { status: 422 })

  const { data, error } = await supabase
    .from('funil_eventos')
    .upsert(linhas, { onConflict: 'marca_id,evento_id', ignoreDuplicates: true })
    .select('id')
  if (error) {
    console.error(`[anuncios] eventos ${marca.slug}: falha ao gravar (${error.code ?? 'sem código'})`)
    return NextResponse.json({ error: 'Não foi possível registrar agora.' }, { status: 500 })
  }

  // Liga à campanha os que vieram com ad_id/utm de campanha já conhecida.
  await supabase.rpc('anuncio_resolver_eventos')

  const gravados = data?.length ?? 0
  return NextResponse.json({ ok: true, recebidos: linhas.length, gravados, repetidos: linhas.length - gravados }, { status: 201 })
}

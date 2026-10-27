import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { usuarioLogado } from '@/lib/asaas/auth'
import { gerarChave, hashChave } from '@/lib/anuncios/eventos'

// Gera (ou troca) a chave de API da marca. A chave volta só nesta resposta;
// no banco fica o hash. Trocar invalida a anterior na hora.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await usuarioLogado())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const chave = gerarChave()
  const supabase = createServiceClient() as any
  const { data, error } = await supabase
    .from('anuncio_marcas')
    .update({ api_key_hash: hashChave(chave), api_key_criada_em: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Não foi possível gerar a chave.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Marca não encontrada.' }, { status: 404 })
  return NextResponse.json({ chave })
}

import { NextRequest, NextResponse, after } from 'next/server'
import { finalizarHtml, gerarHtml, IaErro } from '@/lib/sites/ia'
import { abrirPrevia, salvarVersao } from '@/lib/sites/servidor'

export const maxDuration = 300

// Etapa 2: gera o site em HTML. A resposta é o HTML chegando aos poucos, para
// a tela mostrar o progresso. A geração continua e é salva mesmo que a tela
// seja fechada no meio (after mantém a função viva até terminar).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await abrirPrevia(id)
  if ('erro' in r) return r.erro
  const { supabase, previa } = r
  if (!previa.conteudo) return NextResponse.json({ error: 'Gere e revise os textos antes de gerar o site.' }, { status: 400 })

  await supabase.from('site_previas').update({ status: 'gerando', erro: null, updated_at: new Date().toISOString() }).eq('id', id)

  const encoder = new TextEncoder()
  // Saída para a tela; vira null se a tela fechar (a geração continua).
  const saida: { c: ReadableStreamDefaultController<Uint8Array> | null } = { c: null }
  const enviar = (texto: string) => {
    try { saida.c?.enqueue(encoder.encode(texto)) } catch { saida.c = null }
  }

  const stream = gerarHtml(previa.briefing, previa.conteudo)
  stream.on('text', (delta) => enviar(delta))

  const trabalho = (async () => {
    try {
      const html = await finalizarHtml(stream)
      await salvarVersao(supabase, previa, html, null)
    } catch (e) {
      console.error('[sites] gerar', e)
      const msg = e instanceof IaErro ? e.message : 'Falha ao gerar o site. Tente de novo.'
      await supabase.from('site_previas').update({ status: previa.html ? 'pronto' : 'erro', erro: msg, updated_at: new Date().toISOString() }).eq('id', id)
      // Marcador no fim do stream: a tela mostra o erro em vez do HTML parcial.
      enviar(`\n<!--ERRO:${msg}-->`)
    } finally {
      try { saida.c?.close() } catch {}
    }
  })()
  after(() => trabalho)

  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) { saida.c = c },
      cancel() { saida.c = null }, // tela fechou: a geração segue e é salva
    }),
    { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } },
  )
}

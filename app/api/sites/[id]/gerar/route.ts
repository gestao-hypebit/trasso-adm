import { NextRequest, NextResponse, after } from 'next/server'
import { gerarHtml, IaErro, juntarContinuacao, limparHtml, verificarResposta } from '@/lib/sites/ia'
import { abrirPrevia, salvarVersao } from '@/lib/sites/servidor'

export const maxDuration = 300

// De quanto em quanto tempo o HTML já escrito é salvo (também é o sinal de
// vida que a tela usa para saber se a geração caiu).
const INTERVALO_SALVAR = 8000

// Etapa 2: gera o site em HTML. A resposta é o HTML chegando aos poucos, para
// a tela mostrar o progresso.
//
// A geração pode passar do tempo máximo da função na Vercel. Por isso o que
// já foi escrito vai para html_parcial; com { continuar: true }, a IA recebe
// esse trecho e escreve só o que falta. A tela faz isso sozinha quando a
// geração cai, até o site ficar completo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { continuar } = (await req.json().catch(() => ({}))) as { continuar?: boolean }
  const r = await abrirPrevia(id)
  if ('erro' in r) return r.erro
  const { supabase, previa } = r
  if (!previa.conteudo) return NextResponse.json({ error: 'Gere e revise os textos antes de gerar o site.' }, { status: 400 })

  const base = continuar ? previa.html_parcial ?? '' : ''
  await supabase
    .from('site_previas')
    .update({ status: 'gerando', erro: null, html_parcial: base || null, updated_at: new Date().toISOString() })
    .eq('id', id)

  const encoder = new TextEncoder()
  // Saída para a tela; vira null se a tela fechar (a geração continua).
  const saida: { c: ReadableStreamDefaultController<Uint8Array> | null } = { c: null }
  const enviar = (texto: string) => {
    try { saida.c?.enqueue(encoder.encode(texto)) } catch { saida.c = null }
  }

  let novo = ''
  let ultimoSalvo = Date.now()
  let salvando: Promise<unknown> = Promise.resolve()
  const salvarParcial = () => {
    ultimoSalvo = Date.now()
    const parcial = juntarContinuacao(base, novo)
    salvando = salvando.then(() =>
      supabase.from('site_previas').update({ html_parcial: parcial, updated_at: new Date().toISOString() }).eq('id', id),
    )
  }

  // Na continuação, a tela recebe primeiro o que já existia (para a prévia
  // parcial aparecer inteira) e depois o restante.
  if (base) enviar(base)
  const stream = gerarHtml(previa.briefing, previa.conteudo, base || null)
  stream.on('text', (delta) => {
    novo += delta
    enviar(delta)
    if (Date.now() - ultimoSalvo > INTERVALO_SALVAR) salvarParcial()
  })

  const trabalho = (async () => {
    try {
      const msg = await stream.finalMessage()
      const texto = verificarResposta(msg)
      const completo = juntarContinuacao(base, texto)
      await salvando
      if (!/<\/html>/i.test(completo)) {
        // Parou sem terminar (limite de tamanho): guarda e deixa a tela continuar.
        await supabase.from('site_previas').update({ html_parcial: completo, updated_at: new Date().toISOString() }).eq('id', id)
        return
      }
      await salvarVersao(supabase, previa, limparHtml(completo), null)
      await supabase.from('site_previas').update({ html_parcial: null }).eq('id', id)
    } catch (e) {
      console.error('[sites] gerar', e)
      const msg = e instanceof IaErro ? e.message : 'Falha ao gerar o site. Tente de novo.'
      await salvando
      await supabase
        .from('site_previas')
        .update({ status: previa.html ? 'pronto' : 'erro', erro: msg, updated_at: new Date().toISOString() })
        .eq('id', id)
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

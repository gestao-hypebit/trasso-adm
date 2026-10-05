import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Link público da prévia (/p/<slug>) para mandar ao cliente.
//
// O HTML foi gerado pela IA, então é servido isolado: o cabeçalho
// Content-Security-Policy "sandbox" faz a página rodar numa origem à parte,
// sem acesso aos cookies do admin. ?admin=1 (usado no admin) não conta visualização.

const FAIXA = `
<div style="position:fixed;left:12px;bottom:12px;z-index:2147483647;font:500 12px/1 system-ui,sans-serif;background:rgba(17,17,17,.82);color:#fff;padding:8px 12px;border-radius:999px;backdrop-filter:blur(6px);pointer-events:none">
  Prévia criada por <strong style="color:#B8F000">Slick</strong>
</div>`

function pagina(titulo: string, texto: string, status: number) {
  return new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0f0d14;color:#ece8f5;text-align:center;padding:24px">
<div><p style="font-size:20px;font-weight:600;margin:0 0 8px">${titulo}</p><p style="opacity:.6;margin:0">${texto}</p></div></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServiceClient() as any
  const { data } = await supabase.from('site_previas').select('html, publicada').eq('slug', slug).maybeSingle()

  if (!data || !data.publicada) return pagina('Prévia indisponível', 'Este link não está mais ativo.', 404)
  if (!data.html) return pagina('Prévia em preparação', 'Volte daqui a pouco.', 200)

  if (req.nextUrl.searchParams.get('admin') !== '1') {
    await supabase.rpc('site_previa_visualizar', { p_slug: slug })
  }

  const html = data.html.includes('</body>') ? data.html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${FAIXA}</body>`) : data.html + FAIXA
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'content-security-policy': 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms',
    },
  })
}

import { notFound } from 'next/navigation'
import { autorizarSite } from '@/lib/sites-clientes/acesso'
import { dadosEditor } from '@/lib/sites-clientes/editor-dados'
import { urlDoSite } from '@/lib/sites-clientes/url'
import { EditorConteudo } from '@/components/sites-clientes/editor-conteudo'

export default async function ConteudoClientePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await autorizarSite(siteId, 'cliente')
  if (!auth) notFound()
  const dados = await dadosEditor(siteId)
  return <EditorConteudo siteId={siteId} siteUrl={auth.site.dominio ? urlDoSite(auth.site.dominio) : null} dados={dados} equipe={false} />
}

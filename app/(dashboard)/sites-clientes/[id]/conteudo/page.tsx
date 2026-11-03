import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { autorizarSite } from '@/lib/sites-clientes/acesso'
import { dadosEditor } from '@/lib/sites-clientes/editor-dados'
import { urlDoSite } from '@/lib/sites-clientes/url'
import { EditorConteudo } from '@/components/sites-clientes/editor-conteudo'

export default async function ConteudoSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await autorizarSite(id)
  if (!auth) redirect('/login')
  if (auth.editor.tipo !== 'equipe') notFound()
  const dados = await dadosEditor(id)

  return (
    <div className="flex min-h-screen flex-col">
      <Header title={`Conteúdo · ${auth.site.nome}`} description="O que você publicar aqui vai direto para o site" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Link href={`/sites-clientes/${id}`} className="flex items-center gap-1.5 text-sm text-brand-lavanda/50 hover:text-brand-lavanda">
          <ArrowLeft className="h-4 w-4" /> {auth.site.nome}
        </Link>
        <EditorConteudo siteId={id} siteUrl={auth.site.dominio ? urlDoSite(auth.site.dominio) : null} dados={dados} equipe />
      </main>
    </div>
  )
}

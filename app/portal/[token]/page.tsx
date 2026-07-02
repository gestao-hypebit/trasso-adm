import { notFound } from 'next/navigation'
import { FolderOpen, FileText, FileSignature, Layers } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getClienteByToken } from '@/lib/portal/auth'
import { getServicosContratados } from '@/lib/portal/servicos'
import { createServiceClient } from '@/lib/supabase/service'
import { ProjetoProgressCard, type ProjetoCardData } from '@/components/portal/projeto-progress-card'
import { PropostaCard, type PropostaCardData } from '@/components/portal/proposta-card'
import { ContratoCard, type ContratoCardData } from '@/components/portal/contrato-card'
import { ServicoBadgeList } from '@/components/portal/servico-badge-list'

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const cliente = await getClienteByToken(token)
  if (!cliente) notFound()

  const supabase = createServiceClient()
  const [{ data: projetos }, { data: propostas }, { data: contratos }, servicos, { data: config }] = await Promise.all([
    supabase
      .from('projetos')
      .select('id, nome, descricao, status, progresso, data_entrega, data_conclusao, tarefas(id, titulo, status, ordem)')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('propostas')
      .select('*, clientes(nome, empresa, email), proposta_itens(*)')
      .eq('cliente_id', cliente.id)
      .neq('status', 'rascunho')
      .order('created_at', { ascending: false }),
    supabase
      .from('contratos')
      .select('*')
      .eq('cliente_id', cliente.id)
      .neq('status', 'rascunho')
      .order('created_at', { ascending: false }),
    getServicosContratados(cliente.id),
    (supabase as any).from('configuracoes_agencia').select('logo_url, nome').maybeSingle() as Promise<{ data: { logo_url: string | null; nome: string } | null }>,
  ])

  const agenciaNome = config?.nome ?? 'Trasso'
  const logoUrl = config?.logo_url ?? null

  return (
    <Tabs defaultValue="projetos">
      <TabsList>
        <TabsTrigger value="projetos" className="gap-1.5"><FolderOpen className="h-4 w-4" /> Projetos</TabsTrigger>
        <TabsTrigger value="propostas" className="gap-1.5"><FileText className="h-4 w-4" /> Propostas</TabsTrigger>
        <TabsTrigger value="contratos" className="gap-1.5"><FileSignature className="h-4 w-4" /> Contratos</TabsTrigger>
        <TabsTrigger value="servicos" className="gap-1.5"><Layers className="h-4 w-4" /> Serviços</TabsTrigger>
      </TabsList>

      <TabsContent value="projetos" className="space-y-4">
        {!projetos || projetos.length === 0 ? (
          <EmptyState texto="Nenhum projeto em andamento no momento." />
        ) : (
          (projetos as unknown as ProjetoCardData[]).map((p) => <ProjetoProgressCard key={p.id} projeto={p} />)
        )}
      </TabsContent>

      <TabsContent value="propostas" className="space-y-4">
        {!propostas || propostas.length === 0 ? (
          <EmptyState texto="Nenhuma proposta enviada até o momento." />
        ) : (
          (propostas as unknown as PropostaCardData[]).map((p) => (
            <PropostaCard key={p.id} token={token} proposta={p} logoUrl={logoUrl} agenciaNome={agenciaNome} />
          ))
        )}
      </TabsContent>

      <TabsContent value="contratos" className="space-y-4">
        {!contratos || contratos.length === 0 ? (
          <EmptyState texto="Nenhum contrato disponível até o momento." />
        ) : (
          (contratos as unknown as ContratoCardData[]).map((c) => <ContratoCard key={c.id} token={token} contrato={c} />)
        )}
      </TabsContent>

      <TabsContent value="servicos">
        <ServicoBadgeList servicos={servicos.servicos} extras={servicos.extras} />
      </TabsContent>
    </Tabs>
  )
}

function EmptyState({ texto }: { texto: string }) {
  return <p className="text-sm text-brand-lavanda/40 text-center py-10">{texto}</p>
}

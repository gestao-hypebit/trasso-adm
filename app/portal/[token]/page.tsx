import { notFound } from 'next/navigation'
import { FolderOpen, FileText, FileSignature, Layers, ClipboardList, PackageCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getClienteByToken } from '@/lib/portal/auth'
import { getServicosContratados } from '@/lib/portal/servicos'
import { createServiceClient } from '@/lib/supabase/service'
import { ProjetoProgressCard, type ProjetoCardData } from '@/components/portal/projeto-progress-card'
import { PropostaCard, type PropostaCardData } from '@/components/portal/proposta-card'
import { ContratoCard, type ContratoCardData } from '@/components/portal/contrato-card'
import { ServicoBadgeList } from '@/components/portal/servico-badge-list'
import { OnboardingCard } from '@/components/portal/onboarding-card'
import { EntregaCard } from '@/components/portal/entrega-card'
import { AvaliacaoCard } from '@/components/portal/avaliacao-card'
import { ENTREGA_SELECT, type Entrega } from '@/lib/projetos/entregas'
import type { Briefing, OnboardingItem } from '@/lib/projetos/onboarding'

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
      .select('*, clientes(nome, empresa, email), responsavel:profiles!propostas_responsavel_id_fkey(nome), proposta_itens(*)')
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

  const db = supabase as any
  const projetoIds = (projetos ?? []).map((p: { id: string }) => p.id)
  const nomeProjeto = new Map((projetos ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))
  // Sem projetos, nada de onboarding/entregas; evita um .in() vazio.
  const porProjeto = projetoIds.length > 0
  const [{ data: itensRaw }, { data: briefingsRaw }, { data: entregasRaw }, { data: avaliacoesRaw }] = await Promise.all([
    porProjeto ? db.from('onboarding_itens').select('*').in('projeto_id', projetoIds) : { data: [] },
    porProjeto ? db.from('briefings').select('*').in('projeto_id', projetoIds) : { data: [] },
    porProjeto ? db.from('entregas').select(ENTREGA_SELECT).in('projeto_id', projetoIds).order('created_at', { ascending: false }) : { data: [] },
    db.from('avaliacoes').select('id, projeto_id').eq('cliente_id', cliente.id).eq('status', 'pendente'),
  ])
  const itens = (itensRaw ?? []) as OnboardingItem[]
  const briefings = (briefingsRaw ?? []) as Briefing[]
  const entregas = (entregasRaw ?? []) as Entrega[]
  const avaliacoes = (avaliacoesRaw ?? []) as { id: string; projeto_id: string | null }[]

  // Um bloco de "primeiros passos" por projeto que tem checklist ou briefing.
  const onboardings = projetoIds
    .map((id: string) => ({ id, itens: itens.filter((i) => i.projeto_id === id), briefing: briefings.find((b) => b.projeto_id === id) ?? null }))
    .filter((o: { itens: OnboardingItem[]; briefing: Briefing | null }) => o.itens.length > 0 || o.briefing)
  const onboardingPendente = onboardings.some((o: { itens: OnboardingItem[]; briefing: Briefing | null }) =>
    o.briefing?.status === 'pendente' || o.itens.some((i) => i.responsavel === 'cliente' && !i.concluido))
  const entregasPendentes = entregas.filter((e) => e.status === 'aguardando').length
  const abaInicial = entregasPendentes > 0 ? 'entregas' : onboardingPendente ? 'onboarding' : 'projetos'

  const agenciaNome = config?.nome ?? 'Trasso'
  const logoUrl = config?.logo_url ?? null

  return (
    <div className="space-y-6">
    {avaliacoes.map((a) => (
      <AvaliacaoCard
        key={a.id}
        token={token}
        avaliacaoId={a.id}
        projetoNome={a.projeto_id ? nomeProjeto.get(a.projeto_id) ?? null : null}
        clienteNome={cliente.nome}
        clienteEmpresa={cliente.empresa}
      />
    ))}
    <Tabs defaultValue={abaInicial}>
      <TabsList className="max-w-full overflow-x-auto">
        <TabsTrigger value="projetos" className="gap-1.5"><FolderOpen className="h-4 w-4" /> Projetos</TabsTrigger>
        {onboardings.length > 0 && (
          <TabsTrigger value="onboarding" className="gap-1.5">
            <ClipboardList className="h-4 w-4" /> Primeiros passos
            {onboardingPendente && <span className="h-2 w-2 rounded-full bg-brand-lima" />}
          </TabsTrigger>
        )}
        {entregas.length > 0 && (
          <TabsTrigger value="entregas" className="gap-1.5">
            <PackageCheck className="h-4 w-4" /> Entregas
            {entregasPendentes > 0 && <span className="rounded-full bg-brand-lima px-1.5 text-[10px] font-bold leading-4 text-brand-noite">{entregasPendentes}</span>}
          </TabsTrigger>
        )}
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

      <TabsContent value="onboarding" className="space-y-4">
        {onboardings.map((o: { id: string; itens: OnboardingItem[]; briefing: Briefing | null }) => (
          <OnboardingCard key={o.id} token={token} projetoNome={nomeProjeto.get(o.id) ?? ''} itens={o.itens} briefing={o.briefing} />
        ))}
      </TabsContent>

      <TabsContent value="entregas" className="space-y-4">
        {entregas.map((e) => (
          <EntregaCard key={e.id} token={token} entrega={e} projetoNome={nomeProjeto.get(e.projeto_id) ?? ''} clienteNome={cliente.nome} />
        ))}
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
    </div>
  )
}

function EmptyState({ texto }: { texto: string }) {
  return <p className="text-sm text-brand-lavanda/40 text-center py-10">{texto}</p>
}

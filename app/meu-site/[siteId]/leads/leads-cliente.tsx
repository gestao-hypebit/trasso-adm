'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SiteLeadsLista } from '@/components/sites-clientes/site-leads-lista'
import { excluirSiteLead, mudarStatusSiteLead } from '@/lib/sites-clientes/leads-actions'
import type { SiteLead, SiteLeadStatus } from '@/lib/sites-clientes/leads'

export function LeadsCliente({ leads: iniciais }: { leads: SiteLead[] }) {
  const router = useRouter()
  const [leads, setLeads] = useState(iniciais)
  const [erro, setErro] = useState<string | null>(null)

  async function mudar(id: string, status: SiteLeadStatus) {
    const anterior = leads
    setErro(null)
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)))
    const r = await mudarStatusSiteLead(id, status)
    if (!r.ok) {
      setLeads(anterior)
      setErro(r.erro)
    } else {
      router.refresh() // atualiza o contador de novos na aba
    }
  }

  async function excluir(id: string) {
    const anterior = leads
    setErro(null)
    setLeads((ls) => ls.filter((l) => l.id !== id))
    const r = await excluirSiteLead(id)
    if (!r.ok) {
      setLeads(anterior)
      setErro(r.erro)
    } else {
      router.refresh()
    }
  }

  if (leads.length === 0) {
    return (
      <p className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-brand-lavanda/50">
        Nenhum contato pelo site ainda. Quando alguém preencher o formulário, ele aparece aqui.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-2">
      <p className="pt-3 text-sm text-brand-lavanda/50">Clique em um contato para ver as respostas. Marque o andamento para não perder ninguém.</p>
      {erro && <p className="mt-2 text-sm text-brand-rosa">{erro}</p>}
      <SiteLeadsLista leads={leads} onMudarStatus={mudar} onExcluir={excluir} />
    </div>
  )
}

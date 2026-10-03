'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { BriefingForm } from '@/components/sites/briefing-form'
import { createClient } from '@/lib/supabase/client'
import { SECOES_PADRAO, gerarSlug, type Briefing } from '@/lib/sites/tipos'

type Opcao = { id: string; nome: string; empresa: string | null; telefone: string | null; email: string | null; whatsapp?: string | null }

// Vínculo: "c:<id>" (cliente) ou "l:<id>" (lead).
export function NovaPrevia({ leadInicial, clienteInicial }: { leadInicial?: string; clienteInicial?: string }) {
  const router = useRouter()
  // O id da prévia já nasce aqui: as imagens enviadas vão para a pasta dela.
  const [id] = useState(() => crypto.randomUUID())
  const [briefing, setBriefing] = useState<Briefing>({ empresa: '', secoes: SECOES_PADRAO })
  const [clientes, setClientes] = useState<Opcao[]>([])
  const [leads, setLeads] = useState<Opcao[]>([])
  const [vinculo, setVinculo] = useState(clienteInicial ? `c:${clienteInicial}` : leadInicial ? `l:${leadInicial}` : '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const db = createClient() as any
    Promise.all([
      db.from('clientes').select('id, nome, empresa, telefone, email, whatsapp').order('nome'),
      db.from('leads').select('id, nome, empresa, telefone, email').not('status', 'in', '(convertido,descartado)').order('created_at', { ascending: false }),
    ]).then(([c, l]: { data: Opcao[] | null }[]) => {
      setClientes(c.data ?? [])
      setLeads(l.data ?? [])
    })
  }, [])

  // Escolher cliente/lead preenche o básico do briefing (sem apagar o que já foi digitado).
  useEffect(() => {
    if (!vinculo) return
    const lista = vinculo.startsWith('c:') ? clientes : leads
    const o = lista.find((x) => x.id === vinculo.slice(2))
    if (!o) return
    setBriefing((b) => ({
      ...b,
      empresa: b.empresa || (o.empresa ?? o.nome).trim(),
      whatsapp: b.whatsapp || o.whatsapp || o.telefone || undefined,
      email: b.email || o.email || undefined,
    }))
  }, [vinculo, clientes, leads])

  async function criar() {
    if (!briefing.empresa.trim()) { setErro('Informe o nome da empresa.'); return }
    setSalvando(true)
    setErro(null)
    const { error } = await (createClient() as any).from('site_previas').insert({
      id,
      nome: briefing.empresa.trim(),
      slug: gerarSlug(briefing.empresa),
      briefing,
      cliente_id: vinculo.startsWith('c:') ? vinculo.slice(2) : null,
      lead_id: vinculo.startsWith('l:') ? vinculo.slice(2) : null,
    })
    if (error) {
      setErro(error.code === '42P01' ? 'Rode a migration 20261009000000_sites_previas.sql no Supabase antes de usar.' : error.message)
      setSalvando(false)
      return
    }
    router.push(`/sites/${id}?gerar=1`)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Prévias de site" description="Nova prévia" />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-6">
        <PageHeader title="Nova prévia" description="Preencha o briefing. A IA escreve os textos, você revisa e ela monta o site." />

        <Card className="mb-5">
          <CardContent className="p-5">
            <Label className="mb-1.5 block text-xs text-brand-lavanda/80">Para qual cliente ou lead? (opcional)</Label>
            <select
              value={vinculo}
              onChange={(e) => setVinculo(e.target.value)}
              className="h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-brand-lavanda outline-none"
            >
              <option value="" className="bg-brand-noite">Nenhum (prospecção)</option>
              {leads.length > 0 && (
                <optgroup label="Leads" className="bg-brand-noite">
                  {leads.map((l) => <option key={l.id} value={`l:${l.id}`} className="bg-brand-noite">{l.nome}{l.empresa ? ` · ${l.empresa}` : ''}</option>)}
                </optgroup>
              )}
              <optgroup label="Clientes" className="bg-brand-noite">
                {clientes.map((c) => <option key={c.id} value={`c:${c.id}`} className="bg-brand-noite">{c.nome}{c.empresa && c.empresa !== c.nome ? ` · ${c.empresa}` : ''}</option>)}
              </optgroup>
            </select>
          </CardContent>
        </Card>

        <BriefingForm valor={briefing} onChange={setBriefing} pasta={id} />

        <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-3 border-t border-white/[0.06] bg-brand-noite/95 py-4 backdrop-blur">
          {erro && <p className="mr-auto text-sm text-brand-rosa">{erro}</p>}
          <Button variant="ghost" onClick={() => router.push('/sites')} disabled={salvando}>Cancelar</Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Criar e gerar textos
          </Button>
        </div>
      </main>
    </div>
  )
}

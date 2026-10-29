'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { origemOpcoes } from '@/lib/crm/opcoes'
import { LEAD_SELECT, type Lead } from '@/components/leads/lead-detalhe-dialog'
import { comTemperatura, TEMPERATURAS, temperaturaConfig, type Temperatura } from '@/lib/leads/trafego'
import { frenteLeadOpcoes, MARCA_DA_FRENTE, type FrenteLead } from '@/lib/leads/frente'
import { ehCaptacaoAtiva } from '@/lib/leads/contatos'

type CampanhaOpcao = { campaign_id: string; nome: string; status: string | null }

// Origens que pedem a campanha do anúncio (para o painel de tráfego pago).
const ORIGENS_PAGAS = ['trafego_pago', 'trafego_pago_whatsapp']

// Campanhas da marca do negócio no módulo de anúncios (o que já foi sincronizado do Meta).
async function carregarCampanhas(frente: FrenteLead): Promise<CampanhaOpcao[]> {
  const supabase = createClient() as any
  // anuncio_marcas tem permissão por coluna: lê só as liberadas e filtra aqui (como em /anuncios).
  const { data: marcas } = await supabase.from('anuncio_marcas').select('id, slug')
  const marca = (marcas ?? []).find((m: { slug: string }) => m.slug === MARCA_DA_FRENTE[frente])
  if (!marca) return []
  const { data: vinculos } = await supabase.from('anuncio_campanha_marca').select('campaign_id').eq('marca_id', marca.id)
  const ids = (vinculos ?? []).map((v: { campaign_id: string }) => v.campaign_id)
  if (ids.length === 0) return []
  const { data } = await supabase.from('anuncio_campanhas').select('campaign_id, nome, status').in('campaign_id', ids)
  // Ativas primeiro.
  return ((data ?? []) as CampanhaOpcao[]).sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || a.nome.localeCompare(b.nome))
}

const VAZIO = { nome: '', telefone: '', email: '', empresa: '', frente: 'agencia' as FrenteLead, origem: 'whatsapp', valor_estimado: '', observacoes: '', temperatura: '', campanha: '', proximo_contato: '' }

// Lead que chegou fora do site: WhatsApp, indicação, Instagram, evento...
export function NovoLeadDialog({ open, onOpenChange, onCriado }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCriado: (lead: Lead) => void
}) {
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [campanhas, setCampanhas] = useState<CampanhaOpcao[]>([])
  const pago = ORIGENS_PAGAS.includes(form.origem)

  useEffect(() => {
    if (open && pago) carregarCampanhas(form.frente).then(setCampanhas).catch(() => setCampanhas([]))
  }, [open, pago, form.frente])

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    setErro(null)
    const { data, error } = await (createClient() as any)
      .from('leads')
      .insert({
        nome: form.nome.trim(),
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        empresa: form.empresa.trim() || null,
        frente: form.frente,
        origem: form.origem,
        // Captação ativa: a gente já foi atrás, então não é um "novo" esperando resposta.
        status: ehCaptacaoAtiva(form.origem) ? 'em_contato' : 'novo',
        proximo_contato: form.proximo_contato || null,
        valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
        observacoes: form.observacoes.trim() || null,
        respostas: comTemperatura([], (form.temperatura || null) as Temperatura | null),
        // Mesmo formato das landings: o painel de tráfego pago liga o lead à campanha.
        utm: pago
          ? {
              utm_source: 'meta',
              utm_medium: form.origem === 'trafego_pago_whatsapp' ? 'whatsapp' : 'paid',
              ...(form.campanha ? { utm_campaign: form.campanha } : {}),
            }
          : null,
      })
      .select(LEAD_SELECT)
      .single()
    setSalvando(false)
    if (error || !data) {
      setErro('Não foi possível salvar. A migration do funil já foi aplicada no Supabase?')
      return
    }
    onCriado(data as Lead)
    setForm(VAZIO)
    onOpenChange(false)
  }

  const set = (campo: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>Contato que chegou por fora do site, ou que você foi atrás (captação ativa).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={set('nome')} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={form.telefone} onChange={set('telefone')} placeholder="(16) 91234-5678" />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input value={form.empresa} onChange={set('empresa')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="space-y-1.5">
            <Label>Negócio</Label>
            <div className="flex rounded-lg border border-white/[0.1] p-0.5">
              {frenteLeadOpcoes.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, frente: o.value, campanha: '' }))}
                  className={cn('flex-1 rounded-md px-2.5 py-1.5 text-xs', form.frente === o.value ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50')}
                >{o.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={form.origem} onValueChange={(origem) => setForm((f) => ({ ...f, origem }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {origemOpcoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor estimado (R$)</Label>
              <Input type="number" min="0" step="100" value={form.valor_estimado} onChange={set('valor_estimado')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Temperatura</Label>
              <Select value={form.temperatura || 'sem'} onValueChange={(t) => setForm((f) => ({ ...f, temperatura: t === 'sem' ? '' : t }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem">Sem classificação</SelectItem>
                  {TEMPERATURAS.map((t) => (
                    <SelectItem key={t} value={t}>{temperaturaConfig[t].emoji} {temperaturaConfig[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pago && (
              <div className="space-y-1.5">
                <Label>Campanha</Label>
                {campanhas.length > 0 ? (
                  <Select value={form.campanha || 'sem'} onValueChange={(c) => setForm((f) => ({ ...f, campanha: c === 'sem' ? '' : c }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem">Não sei</SelectItem>
                      {campanhas.map((c) => (
                        <SelectItem key={c.campaign_id} value={c.campaign_id}>
                          {c.nome}{c.status === 'ACTIVE' ? '' : ' (pausada)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.campanha} onChange={set('campanha')} placeholder="Nome da campanha" />
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Próximo contato</Label>
            <Input type="date" value={form.proximo_contato} onChange={set('proximo_contato')} />
          </div>
          <div className="space-y-1.5">
            <Label>Anotações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={set('observacoes')} placeholder="O que a pessoa precisa?" />
          </div>
          {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !form.nome.trim()}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

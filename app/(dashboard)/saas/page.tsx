'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, TrendingUp, Users, Layers, ExternalLink, MoreHorizontal } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Produto = {
  id: string
  nome: string
  descricao: string | null
  cor: string
  url: string | null
  ativo: boolean
  mrr?: number
  clientes_ativos?: number
  clientes_trial?: number
}

const CORES_PRESET = [
  '#7C3AED', '#B8F000', '#FF4D8D', '#06B6D4', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6',
]

export default function SaasPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [novoOpen, setNovoOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ nome: '', descricao: '', url: '', cor: '#7C3AED' })

  async function load() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const { data: prods } = await supabase
      .from('produtos')
      .select('*')
      .eq('tipo', 'saas')
      .eq('ativo', true)
      .order('created_at', { ascending: true }) as { data: Produto[] | null }

    if (!prods) { setLoading(false); return }

    const comMetricas = await Promise.all(
      prods.map(async (p) => {
        const { data: clientes } = await supabase
          .from('saas_clientes')
          .select('mrr, status')
          .eq('produto_id', p.id) as { data: { mrr: number; status: string }[] | null }

        const ativos = clientes?.filter(c => c.status === 'ativo') ?? []
        const trials = clientes?.filter(c => c.status === 'trial') ?? []
        const mrr = ativos.reduce((s, c) => s + (c.mrr ?? 0), 0)

        return {
          ...p,
          mrr,
          clientes_ativos: ativos.length,
          clientes_trial: trials.length,
        }
      })
    )

    setProdutos(comMetricas)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCriar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    const supabase = createClient()
    await (supabase as any).from('produtos').insert({
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      url: form.url || null,
      cor: form.cor,
      tipo: 'saas',
      ativo: true,
    })
    setForm({ nome: '', descricao: '', url: '', cor: '#7C3AED' })
    setNovoOpen(false)
    setSalvando(false)
    setLoading(true)
    load()
  }

  const mrrTotal = produtos.reduce((s, p) => s + (p.mrr ?? 0), 0)
  const clientesTotal = produtos.reduce((s, p) => s + (p.clientes_ativos ?? 0), 0)
  const trialsTotal = produtos.reduce((s, p) => s + (p.clientes_trial ?? 0), 0)

  return (
    <div>
      <Header title="Produtos SaaS" description="Gerencie seus produtos e assinaturas" />
      <div className="p-6 space-y-6">
        <PageHeader title="Produtos SaaS" description="Visão consolidada de todos os seus SaaS">
          <Button onClick={() => setNovoOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Produto
          </Button>
        </PageHeader>

        {/* KPIs consolidados */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-brand-lavanda/40 mb-3">MRR Total (todos SaaS)</p>
              <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {loading ? '...' : formatCurrency(mrrTotal)}
              </p>
              <p className="text-xs text-brand-lavanda/40 mt-1">receita mensal recorrente</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-brand-lavanda/40 mb-3">Assinantes Ativos</p>
              <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {loading ? '...' : clientesTotal}
              </p>
              <p className="text-xs text-brand-lavanda/40 mt-1">em todos os produtos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-brand-lavanda/40 mb-3">Em Trial</p>
              <p className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {loading ? '...' : trialsTotal}
              </p>
              <p className="text-xs text-brand-lavanda/40 mt-1">aguardando conversão</p>
            </CardContent>
          </Card>
        </div>

        {/* Cards por produto */}
        {loading ? (
          <p className="text-sm text-brand-lavanda/40 py-8 text-center">Carregando produtos...</p>
        ) : produtos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/[0.04] flex items-center justify-center">
                <Layers className="h-6 w-6 text-brand-lavanda/30" />
              </div>
              <div className="text-center">
                <p className="text-sm text-brand-lavanda/60 font-medium">Nenhum produto cadastrado</p>
                <p className="text-xs text-brand-lavanda/30 mt-1">Adicione seu primeiro SaaS para começar a gerenciar assinaturas</p>
              </div>
              <Button onClick={() => setNovoOpen(true)} className="gap-2 mt-2">
                <Plus className="h-4 w-4" /> Adicionar Produto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {produtos.map((p) => (
              <Card key={p.id} className="group hover:border-white/[0.12] transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black text-brand-noite shrink-0"
                        style={{ background: p.cor }}
                      >
                        {p.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-brand-lavanda">{p.nome}</h3>
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-brand-lavanda/30 hover:text-brand-lavanda/60 flex items-center gap-1 transition-colors">
                            {p.url.replace(/^https?:\/\//, '')}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <Badge variant="ativo">ativo</Badge>
                  </div>

                  {p.descricao && (
                    <p className="text-xs text-brand-lavanda/50 mb-4 leading-relaxed">{p.descricao}</p>
                  )}

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                      <p className="text-base font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                        {formatCurrency(p.mrr ?? 0)}
                      </p>
                      <p className="text-[10px] text-brand-lavanda/40 mt-0.5">MRR</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                      <p className="text-base font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                        {p.clientes_ativos ?? 0}
                      </p>
                      <p className="text-[10px] text-brand-lavanda/40 mt-0.5">ativos</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                      <p className="text-base font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                        {p.clientes_trial ?? 0}
                      </p>
                      <p className="text-[10px] text-brand-lavanda/40 mt-0.5">trial</p>
                    </div>
                  </div>

                  <Link href={`/saas/${p.id}`}>
                    <Button variant="outline" size="sm" className="w-full text-xs gap-2">
                      <Users className="h-3.5 w-3.5" /> Gerenciar clientes
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal novo produto */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Produto SaaS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nome do produto *</Label>
              <Input
                placeholder="ex: CatalogoPlace"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Breve descrição do produto"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>URL do produto</Label>
              <Input
                placeholder="https://catalogoplace.com"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {CORES_PRESET.map(cor => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, cor }))}
                    className="h-7 w-7 rounded-lg transition-transform hover:scale-110"
                    style={{
                      background: cor,
                      outline: form.cor === cor ? `2px solid ${cor}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
              <Button onClick={handleCriar} disabled={salvando || !form.nome.trim()}>
                {salvando ? 'Salvando...' : 'Criar Produto'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

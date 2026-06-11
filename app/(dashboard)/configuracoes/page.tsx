'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Save, Plus, Trash2, Upload, User, Building2, Palette, DollarSign, Hash, Link, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const tabs = [
  { key: 'agencia', label: 'Agência', icon: Building2 },
  { key: 'servicos', label: 'Serviços', icon: Palette },
  { key: 'equipe', label: 'Equipe', icon: User },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { key: 'numeracao', label: 'Numeração', icon: Hash },
  { key: 'integracoes', label: 'Integrações', icon: Link },
]

const categoriaLabel: Record<string, string> = {
  identidade_visual: 'Identidade Visual',
  site: 'Site',
  software: 'Software',
  marketing: 'Marketing',
  social_media: 'Social Media',
  outro: 'Outro',
}

type Config = {
  id: string | null
  nome: string; cnpj: string; email: string; telefone: string
  site: string; cidade: string; endereco: string; logo_url: string | null
  proposta_prefixo: string; proposta_contador: number
  contrato_prefixo: string; contrato_contador: number
}

type Servico = { id: string; nome: string; categoria: string | null; preco_base: number | null; unidade: string; ativo: boolean }
type Profile = { id: string; nome: string; email: string; cargo: string | null; avatar_url: string | null }
type Categoria = { id: string; nome: string; tipo: string; cor: string }

const defaultConfig: Config = {
  id: null, nome: '', cnpj: '', email: '', telefone: '', site: '',
  cidade: '', endereco: '', logo_url: null,
  proposta_prefixo: 'TRS', proposta_contador: 1,
  contrato_prefixo: 'CONT', contrato_contador: 1,
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function pad(n: number) {
  return String(n).padStart(3, '0')
}

export default function ConfiguracoesPage() {
  const [aba, setAba] = useState('agencia')
  const [config, setConfig] = useState<Config>(defaultConfig)
  const [servicos, setServicos] = useState<Servico[]>([])
  const [equipe, setEquipe] = useState<Profile[]>([])
  const [categoriasReceita, setCategoriasReceita] = useState<Categoria[]>([])
  const [categoriasDespesa, setCategoriasDespesa] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Serviços form
  const [novoServico, setNovoServico] = useState(false)
  const [servicoForm, setServicoForm] = useState({ nome: '', categoria: 'identidade_visual', preco_base: '', unidade: 'projeto' })

  // Categorias inline
  const [novaReceitaInput, setNovaReceitaInput] = useState('')
  const [novaDespesaInput, setNovaDespesaInput] = useState('')

  const logoInputRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const supabase = createClient()
    const db = supabase as any
    async function load() {
      const [configRes, servicosRes, equipeRes, categoriasRes] = await Promise.all([
        db.from('configuracoes_agencia').select('*').limit(1).maybeSingle() as Promise<{ data: any; error: any }>,
        supabase.from('servicos').select('id, nome, categoria, preco_base, unidade, ativo').order('nome'),
        supabase.from('profiles').select('id, nome, email, cargo, avatar_url'),
        supabase.from('categorias_financeiras').select('id, nome, tipo, cor').order('nome'),
      ])

      if (configRes.data) {
        const c = configRes.data
        setConfig({
          id: c.id,
          nome: c.nome ?? '',
          cnpj: c.cnpj ?? '',
          email: c.email ?? '',
          telefone: c.telefone ?? '',
          site: c.site ?? '',
          cidade: c.cidade ?? '',
          endereco: c.endereco ?? '',
          logo_url: c.logo_url ?? null,
          proposta_prefixo: c.proposta_prefixo ?? 'TRS',
          proposta_contador: c.proposta_contador ?? 1,
          contrato_prefixo: c.contrato_prefixo ?? 'CONT',
          contrato_contador: c.contrato_contador ?? 1,
        })
      }

      setServicos((servicosRes.data as Servico[]) ?? [])
      setEquipe((equipeRes.data as Profile[]) ?? [])
      const cats = (categoriasRes.data as Categoria[]) ?? []
      setCategoriasReceita(cats.filter(c => c.tipo === 'receita'))
      setCategoriasDespesa(cats.filter(c => c.tipo === 'despesa'))
      setLoading(false)
    }
    load()
  }, [])

  async function saveConfig() {
    setSaving(true)
    const db = createClient() as any
    const payload = {
      nome: config.nome, cnpj: config.cnpj || null, email: config.email || null,
      telefone: config.telefone || null, site: config.site || null,
      cidade: config.cidade || null, endereco: config.endereco || null,
    }
    let error
    if (config.id) {
      ({ error } = await db.from('configuracoes_agencia').update(payload).eq('id', config.id))
    } else {
      const res = await db.from('configuracoes_agencia').insert(payload).select('id').single() as { data: { id: string } | null; error: any }
      error = res.error
      if (!error && res.data?.id) setConfig(prev => ({ ...prev, id: res.data!.id }))
    }
    setSaving(false)
    showToast(error ? `Erro: ${error.message}` : 'Dados salvos!', !error)
  }

  async function saveNumeracao() {
    if (!config.id) { showToast('Salve os dados da agência primeiro.', false); return }
    setSaving(true)
    const db = createClient() as any
    const { error } = await db.from('configuracoes_agencia').update({
      proposta_prefixo: config.proposta_prefixo,
      proposta_contador: config.proposta_contador,
      contrato_prefixo: config.contrato_prefixo,
      contrato_contador: config.contrato_contador,
    }).eq('id', config.id)
    setSaving(false)
    showToast(error ? `Erro: ${error.message}` : 'Configurações salvas!', !error)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    const supabase = createClient()
    const db = supabase as any
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `agency/logo.${ext}`
    const { error: uploadError } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (uploadError) {
      showToast(`Erro ao enviar: ${uploadError.message}`, false)
      setLogoUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
    const logoUrl = urlData.publicUrl
    if (config.id) {
      await db.from('configuracoes_agencia').update({ logo_url: logoUrl }).eq('id', config.id)
    }
    setConfig(prev => ({ ...prev, logo_url: logoUrl }))
    setLogoUploading(false)
    showToast('Logo atualizada!')
  }

  async function addServico() {
    if (!servicoForm.nome.trim()) return
    const db = createClient() as any
    const { data, error } = await db.from('servicos').insert({
      nome: servicoForm.nome.trim(),
      categoria: servicoForm.categoria || null,
      preco_base: servicoForm.preco_base ? parseFloat(servicoForm.preco_base) : null,
      unidade: servicoForm.unidade,
      ativo: true,
    }).select('id, nome, categoria, preco_base, unidade, ativo').single() as { data: Servico | null; error: any }
    if (!error && data) {
      setServicos(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
      setServicoForm({ nome: '', categoria: 'identidade_visual', preco_base: '', unidade: 'projeto' })
      setNovoServico(false)
      showToast('Serviço adicionado!')
    } else {
      showToast('Erro ao adicionar serviço.', false)
    }
  }

  async function deleteServico(id: string) {
    const { error } = await (createClient() as any).from('servicos').delete().eq('id', id)
    if (!error) setServicos(prev => prev.filter(s => s.id !== id))
    else showToast('Erro ao excluir.', false)
  }

  async function toggleServico(id: string, ativo: boolean) {
    const { error } = await (createClient() as any).from('servicos').update({ ativo: !ativo }).eq('id', id)
    if (!error) setServicos(prev => prev.map(s => s.id === id ? { ...s, ativo: !s.ativo } : s))
    else showToast('Erro ao alterar status.', false)
  }

  async function addCategoria(tipo: 'receita' | 'despesa', nome: string) {
    if (!nome.trim()) return
    const db = createClient() as any
    const { data, error } = await db.from('categorias_financeiras').insert({
      nome: nome.trim(), tipo,
      cor: tipo === 'receita' ? '#B8F000' : '#FF4D8D',
    }).select('id, nome, tipo, cor').single() as { data: Categoria | null; error: any }
    if (!error && data) {
      if (tipo === 'receita') { setCategoriasReceita(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome))); setNovaReceitaInput('') }
      else { setCategoriasDespesa(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome))); setNovaDespesaInput('') }
      showToast('Categoria adicionada!')
    } else {
      showToast('Erro ao adicionar.', false)
    }
  }

  async function deleteCategoria(id: string, tipo: 'receita' | 'despesa') {
    const { error } = await (createClient() as any).from('categorias_financeiras').delete().eq('id', id)
    if (!error) {
      if (tipo === 'receita') setCategoriasReceita(prev => prev.filter(c => c.id !== id))
      else setCategoriasDespesa(prev => prev.filter(c => c.id !== id))
    } else {
      showToast('Erro ao excluir.', false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Configurações" description="Configurações da agência" />

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm shadow-xl border transition-all',
          toast.ok
            ? 'bg-brand-lima/10 border-brand-lima/30 text-brand-lima'
            : 'bg-brand-rosa/10 border-brand-rosa/30 text-brand-rosa'
        )}>
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <main className="flex-1 p-6">
        <PageHeader title="Configurações" />

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Nav lateral */}
          <nav className="lg:w-52 shrink-0">
            <div className="space-y-1">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setAba(key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                    aba === key
                      ? 'bg-white/[0.07] text-brand-lavanda border border-white/[0.12]'
                      : 'text-brand-lavanda/60 hover:text-brand-lavanda hover:bg-brand-violeta/10'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0">
            {loading ? (
              <Card><CardContent className="py-12 text-center text-brand-lavanda/40 text-sm">Carregando...</CardContent></Card>
            ) : (
              <>
                {/* ── Agência ── */}
                {aba === 'agencia' && (
                  <Card>
                    <CardHeader><CardTitle>Dados da Agência</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      {/* Logo */}
                      <div className="flex items-center gap-6">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.07] border border-white/[0.1] shrink-0 overflow-hidden">
                          {config.logo_url ? (
                            <Image src={config.logo_url} alt="Logo" width={80} height={80} className="object-contain" unoptimized />
                          ) : (
                            <span className="text-3xl font-bold text-brand-lima">
                              {config.nome?.[0]?.toUpperCase() ?? 'T'}
                            </span>
                          )}
                        </div>
                        <div>
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/svg+xml,image/jpeg,image/webp"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={logoUploading}
                            onClick={() => logoInputRef.current?.click()}
                          >
                            <Upload className="h-4 w-4" />
                            {logoUploading ? 'Enviando...' : 'Carregar Logo'}
                          </Button>
                          <p className="text-xs text-brand-lavanda/40 mt-1.5">PNG, SVG, JPG ou WebP, max 2MB</p>
                          {config.logo_url && (
                            <button
                              className="text-xs text-brand-rosa/60 hover:text-brand-rosa mt-1 underline"
                              onClick={async () => {
                                await (createClient() as any).from('configuracoes_agencia').update({ logo_url: null }).eq('id', config.id!)
                                setConfig(prev => ({ ...prev, logo_url: null }))
                              }}
                            >
                              Remover logo
                            </button>
                          )}
                        </div>
                      </div>

                      <Separator className="bg-brand-violeta/20" />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { label: 'Nome da Agência', key: 'nome' as const },
                          { label: 'CNPJ', key: 'cnpj' as const },
                          { label: 'Email', key: 'email' as const },
                          { label: 'Telefone', key: 'telefone' as const },
                          { label: 'Site', key: 'site' as const },
                          { label: 'Cidade / Estado', key: 'cidade' as const },
                        ].map(({ label, key }) => (
                          <div key={key}>
                            <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">{label}</Label>
                            <Input
                              value={config[key] ?? ''}
                              onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
                            />
                          </div>
                        ))}
                        <div className="sm:col-span-2">
                          <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Endereço</Label>
                          <Input
                            value={config.endereco ?? ''}
                            onChange={e => setConfig(prev => ({ ...prev, endereco: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={saveConfig} disabled={saving}>
                          <Save className="h-4 w-4" />
                          {saving ? 'Salvando...' : 'Salvar Dados'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Serviços ── */}
                {aba === 'servicos' && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Catálogo de Serviços</CardTitle>
                        <Button size="sm" onClick={() => setNovoServico(true)}>
                          <Plus className="h-4 w-4" />
                          Novo Serviço
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {/* Formulário novo serviço */}
                      {novoServico && (
                        <div className="border-b border-brand-lima/20 bg-brand-lima/[0.03] px-6 py-4">
                          <p className="text-xs text-brand-lima/70 font-medium mb-3">Novo Serviço</p>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="sm:col-span-2">
                              <Input
                                placeholder="Nome do serviço"
                                value={servicoForm.nome}
                                onChange={e => setServicoForm(prev => ({ ...prev, nome: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && addServico()}
                              />
                            </div>
                            <div>
                              <Select value={servicoForm.categoria} onValueChange={v => setServicoForm(prev => ({ ...prev, categoria: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(categoriaLabel).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Input
                                placeholder="Preço base"
                                type="number"
                                value={servicoForm.preco_base}
                                onChange={e => setServicoForm(prev => ({ ...prev, preco_base: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <Select value={servicoForm.unidade} onValueChange={v => setServicoForm(prev => ({ ...prev, unidade: v }))}>
                              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="projeto">Por projeto</SelectItem>
                                <SelectItem value="mes">Por mês</SelectItem>
                                <SelectItem value="hora">Por hora</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" onClick={addServico}>Salvar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setNovoServico(false)}>Cancelar</Button>
                          </div>
                        </div>
                      )}

                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="text-left text-xs text-brand-lavanda/50 font-medium px-6 py-3">Serviço</th>
                            <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Categoria</th>
                            <th className="text-right text-xs text-brand-lavanda/50 font-medium px-4 py-3">Preço Base</th>
                            <th className="text-left text-xs text-brand-lavanda/50 font-medium px-4 py-3">Unidade</th>
                            <th className="text-center text-xs text-brand-lavanda/50 font-medium px-4 py-3">Status</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {servicos.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-brand-lavanda/40 text-sm">Nenhum serviço cadastrado.</td></tr>
                          ) : servicos.map((s) => (
                            <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-3 font-medium text-brand-lavanda">{s.nome}</td>
                              <td className="px-4 py-3 text-brand-lavanda/60 text-xs">{categoriaLabel[s.categoria ?? ''] ?? s.categoria ?? '—'}</td>
                              <td className="px-4 py-3 text-right font-semibold text-brand-lavanda">
                                {s.preco_base != null ? formatCurrency(s.preco_base) : '—'}
                              </td>
                              <td className="px-4 py-3 text-brand-lavanda/60 text-xs capitalize">{s.unidade}</td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => toggleServico(s.id, s.ativo)}>
                                  <Badge variant={s.ativo ? 'ativo' : 'inativo'}>
                                    {s.ativo ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-brand-rosa/50 hover:text-brand-rosa"
                                  onClick={() => deleteServico(s.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}

                {/* ── Equipe ── */}
                {aba === 'equipe' && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Equipe</CardTitle>
                        <span className="text-xs text-brand-lavanda/40">Membros com acesso à plataforma</span>
                      </div>
                    </CardHeader>
                    <CardContent className="divide-y divide-brand-violeta/10">
                      {equipe.length === 0 ? (
                        <p className="text-center text-brand-lavanda/40 text-sm py-8">Nenhum membro encontrado.</p>
                      ) : equipe.map((m) => (
                        <div key={m.id} className="flex items-center gap-4 py-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-brand-lavanda font-semibold text-sm overflow-hidden">
                            {m.avatar_url ? (
                              <Image src={m.avatar_url} alt={m.nome} width={40} height={40} className="object-cover" unoptimized />
                            ) : (
                              getInitials(m.nome)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-brand-lavanda text-sm">{m.nome}</p>
                            <p className="text-xs text-brand-lavanda/50">{m.email}{m.cargo ? ` • ${m.cargo}` : ''}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* ── Financeiro ── */}
                {aba === 'financeiro' && (
                  <div className="space-y-4">
                    {/* Receitas */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Categorias de Receita</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {categoriasReceita.length === 0 && (
                          <p className="text-xs text-brand-lavanda/40 py-2">Nenhuma categoria cadastrada.</p>
                        )}
                        {categoriasReceita.map((c) => (
                          <div key={c.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.cor }} />
                              <span className="text-sm text-brand-lavanda">{c.nome}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-brand-rosa/40 hover:text-brand-rosa"
                              onClick={() => deleteCategoria(c.id, 'receita')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                          <Input
                            placeholder="Nova categoria de receita..."
                            value={novaReceitaInput}
                            onChange={e => setNovaReceitaInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addCategoria('receita', novaReceitaInput)}
                            className="flex-1"
                          />
                          <Button size="sm" variant="outline" onClick={() => addCategoria('receita', novaReceitaInput)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Despesas */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Categorias de Despesa</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {categoriasDespesa.length === 0 && (
                          <p className="text-xs text-brand-lavanda/40 py-2">Nenhuma categoria cadastrada.</p>
                        )}
                        {categoriasDespesa.map((c) => (
                          <div key={c.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.cor }} />
                              <span className="text-sm text-brand-lavanda">{c.nome}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-brand-rosa/40 hover:text-brand-rosa"
                              onClick={() => deleteCategoria(c.id, 'despesa')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                          <Input
                            placeholder="Nova categoria de despesa..."
                            value={novaDespesaInput}
                            onChange={e => setNovaDespesaInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addCategoria('despesa', novaDespesaInput)}
                            className="flex-1"
                          />
                          <Button size="sm" variant="outline" onClick={() => addCategoria('despesa', novaDespesaInput)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* ── Numeração ── */}
                {aba === 'numeracao' && (
                  <Card>
                    <CardHeader><CardTitle>Padrões de Numeração</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      {[
                        { label: 'Propostas', prefixoKey: 'proposta_prefixo' as const, contadorKey: 'proposta_contador' as const },
                        { label: 'Contratos', prefixoKey: 'contrato_prefixo' as const, contadorKey: 'contrato_contador' as const },
                      ].map((item) => (
                        <div key={item.label}>
                          <h4 className="text-sm font-semibold text-brand-lavanda mb-3">{item.label}</h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Prefixo</Label>
                              <Input
                                value={config[item.prefixoKey]}
                                onChange={e => setConfig(prev => ({ ...prev, [item.prefixoKey]: e.target.value.toUpperCase() }))}
                                maxLength={8}
                              />
                            </div>
                            <div>
                              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Próximo número</Label>
                              <Input
                                type="number"
                                min={1}
                                value={config[item.contadorKey]}
                                onChange={e => setConfig(prev => ({ ...prev, [item.contadorKey]: parseInt(e.target.value) || 1 }))}
                              />
                            </div>
                            <div>
                              <Label className="text-brand-lavanda/80 text-xs mb-1.5 block">Preview</Label>
                              <div className="h-10 flex items-center px-3 rounded-xl border border-white/[0.1] bg-white/[0.02]">
                                <span className="font-mono text-sm text-brand-lima">
                                  {config[item.prefixoKey]}-{new Date().getFullYear()}-{pad(config[item.contadorKey])}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Separator className="mt-4 bg-brand-violeta/20" />
                        </div>
                      ))}
                      <div className="flex justify-end">
                        <Button onClick={saveNumeracao} disabled={saving}>
                          <Save className="h-4 w-4" />
                          {saving ? 'Salvando...' : 'Salvar Configurações'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Integrações ── */}
                {aba === 'integracoes' && (
                  <div className="space-y-4">
                    {[
                      { nome: 'ClickSign', desc: 'Assinatura digital de contratos' },
                      { nome: 'D4Sign', desc: 'Assinatura eletrônica avançada' },
                      { nome: 'WhatsApp Business API', desc: 'Envio de notificações e propostas via WhatsApp' },
                      { nome: 'Google Calendar', desc: 'Sincronização de eventos e deadlines' },
                    ].map((int) => (
                      <Card key={int.nome} className="opacity-70">
                        <CardContent className="p-5 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-brand-lavanda text-sm">{int.nome}</p>
                            <p className="text-xs text-brand-lavanda/50 mt-0.5">{int.desc}</p>
                          </div>
                          <Badge variant="outline" className="text-brand-lavanda/40 border-brand-lavanda/20">Em breve</Badge>
                        </CardContent>
                      </Card>
                    ))}
                    <p className="text-xs text-brand-lavanda/30 text-center mt-4">
                      As integrações serão disponibilizadas em breve.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

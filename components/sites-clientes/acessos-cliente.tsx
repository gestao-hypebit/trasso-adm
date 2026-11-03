'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Loader2, Plus, Trash2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { formatRelative } from '@/lib/utils'

type Acesso = { id: string; email: string; nome: string | null; ativo: boolean; ultimo_acesso: string | null }

// Quem do cliente pode entrar em /entrar (vale para todos os sites do cliente).
export function AcessosCliente({ clienteId, emailSugerido }: { clienteId: string; emailSugerido: string | null }) {
  const [acessos, setAcessos] = useState<Acesso[]>([])
  const [carregando, setCarregando] = useState(true)
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    ;(createClient() as any)
      .from('cliente_acessos').select('id, email, nome, ativo, ultimo_acesso').eq('cliente_id', clienteId).order('created_at')
      .then(({ data, error }: { data: Acesso[] | null; error: unknown }) => {
        if (error) setErro('Não foi possível carregar. A migration 20261111000000_cliente_login_conteudo.sql já foi aplicada?')
        setAcessos(data ?? [])
        setCarregando(false)
      })
  }, [clienteId])

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    const limpo = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) return setErro('E-mail inválido.')
    setSalvando(true)
    setErro(null)
    const { data, error } = await (createClient() as any)
      .from('cliente_acessos').insert({ cliente_id: clienteId, email: limpo, nome: nome.trim() || null })
      .select('id, email, nome, ativo, ultimo_acesso').single()
    setSalvando(false)
    if (error) return setErro(error.code === '23505' ? 'Este e-mail já tem acesso (aqui ou em outro cliente).' : 'Não foi possível adicionar.')
    setAcessos((a) => [...a, data])
    setEmail('')
    setNome('')
  }

  async function alternar(a: Acesso) {
    const db = createClient() as any
    const { error } = await db.from('cliente_acessos').update({ ativo: !a.ativo }).eq('id', a.id)
    if (error) return setErro('Não foi possível alterar.')
    setAcessos((l) => l.map((x) => (x.id === a.id ? { ...x, ativo: !a.ativo } : x)))
  }

  async function remover(a: Acesso) {
    if (!window.confirm(`Remover o acesso de ${a.email}? A pessoa sai da área do cliente na hora.`)) return
    const { error } = await (createClient() as any).from('cliente_acessos').delete().eq('id', a.id)
    if (error) return setErro('Não foi possível remover.')
    setAcessos((l) => l.filter((x) => x.id !== a.id))
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/entrar`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-brand-lavanda/40" /> Acesso do cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-brand-lavanda/50">
          Quem estiver aqui entra em <span className="font-mono text-brand-lavanda/70">/entrar</span> com um código no e-mail, edita o site e vê os contatos.
        </p>
        <Button size="sm" variant="outline" className="gap-2" onClick={copiarLink}>
          {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiado ? 'Copiado' : 'Copiar link de acesso'}
        </Button>

        {carregando ? (
          <Loader2 className="h-4 w-4 animate-spin text-brand-lavanda/40" />
        ) : acessos.length > 0 && (
          <ul className="divide-y divide-white/[0.06]">
            {acessos.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-brand-lavanda/85">{a.nome || a.email}</p>
                  <p className="truncate text-[11px] text-brand-lavanda/40">
                    {a.nome && <>{a.email} · </>}{a.ultimo_acesso ? `entrou ${formatRelative(a.ultimo_acesso)}` : 'nunca entrou'}
                  </p>
                </div>
                <button type="button" onClick={() => alternar(a)} title={a.ativo ? 'Pausar acesso' : 'Reativar acesso'}>
                  <Badge variant={a.ativo ? 'ativo' : 'inativo'}>{a.ativo ? 'Ativo' : 'Pausado'}</Badge>
                </button>
                <button type="button" onClick={() => remover(a)} title="Remover" aria-label="Remover acesso"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-brand-lavanda/35 hover:bg-white/[0.05] hover:text-brand-rosa">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={adicionar} className="space-y-2 border-t border-white/[0.06] pt-3">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={emailSugerido || 'email@cliente.com'} />
          <div className="flex gap-2">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (opcional)" />
            <Button type="submit" size="sm" className="h-9 shrink-0 gap-1.5" disabled={salvando || !email.trim()}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Liberar
            </Button>
          </div>
          {emailSugerido && !email && !acessos.some((a) => a.email === emailSugerido.toLowerCase()) && (
            <button type="button" onClick={() => setEmail(emailSugerido)} className="text-[11px] text-brand-lavanda/45 hover:text-brand-lavanda">
              Usar o e-mail do cadastro: {emailSugerido}
            </button>
          )}
          {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
        </form>
      </CardContent>
    </Card>
  )
}

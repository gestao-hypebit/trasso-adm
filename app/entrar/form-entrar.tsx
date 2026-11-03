'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { entrarComCodigo, pedirCodigo } from './actions'

export function FormEntrar() {
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviarEmail(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const r = await pedirCodigo(email)
    setCarregando(false)
    if (!r.ok) return setErro(r.erro)
    setCodigo('')
    setEtapa('codigo')
  }

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    // Em caso de sucesso a action redireciona para /meu-site.
    const r = await entrarComCodigo(email, codigo)
    setCarregando(false)
    if (r && !r.ok) setErro(r.erro)
  }

  if (etapa === 'email') {
    return (
      <form onSubmit={enviarEmail} className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Entrar</h1>
          <p className="mt-1.5 text-sm text-brand-lavanda/55">Edite o seu site e veja os contatos que chegaram por ele. A gente manda um código para o seu e-mail.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
        </div>
        {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
        <Button type="submit" className="w-full gap-2" disabled={carregando}>
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Receber código
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={enviarCodigo} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-lavanda" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Digite o código</h1>
        <p className="mt-1.5 text-sm text-brand-lavanda/55">
          Se <span className="text-brand-lavanda">{email}</span> tiver acesso, o código de 6 números chega em instantes. Olhe também o spam.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="codigo">Código</Label>
        <Input
          id="codigo" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={6} pattern="\d{6}"
          value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="text-center font-mono text-2xl tracking-[0.5em]" placeholder="••••••"
        />
      </div>
      {erro && <p className="text-sm text-brand-rosa">{erro}</p>}
      <Button type="submit" className="w-full gap-2" disabled={carregando || codigo.length !== 6}>
        {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Entrar
      </Button>
      <p className="text-xs text-brand-lavanda/40">
        Não chegou em alguns minutos? Confira se digitou o e-mail certo ou peça para a equipe da Slick liberar o seu acesso.
      </p>
      <div className="flex justify-between text-xs">
        <button type="button" onClick={() => { setEtapa('email'); setErro(null) }} className="flex items-center gap-1 text-brand-lavanda/50 hover:text-brand-lavanda">
          <ArrowLeft className="h-3 w-3" /> Outro e-mail
        </button>
        <button type="button" onClick={(e) => enviarEmail(e as unknown as React.FormEvent)} disabled={carregando} className="text-brand-lavanda/50 hover:text-brand-lavanda">
          Reenviar código
        </button>
      </div>
    </form>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FolderOpen, DollarSign, FileText,
  FileSignature, CheckSquare, Calendar, BarChart2, Settings, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/clientes',      icon: Users,           label: 'Clientes' },
  { href: '/projetos',      icon: FolderOpen,      label: 'Projetos' },
  { href: '/financeiro',    icon: DollarSign,      label: 'Financeiro' },
  { href: '/propostas',     icon: FileText,        label: 'Propostas' },
  { href: '/contratos',     icon: FileSignature,   label: 'Contratos' },
  { href: '/tarefas',       icon: CheckSquare,     label: 'Tarefas' },
  { href: '/agenda',        icon: Calendar,        label: 'Agenda' },
  { href: '/relatorios',    icon: BarChart2,       label: 'Relatórios' },
  { href: '/configuracoes', icon: Settings,        label: 'Configurações' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [agenciaNome, setAgenciaNome] = useState('Trasso')
  const [userNome, setUserNome] = useState('')
  const [userAvatar, setUserAvatar] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const db = supabase as any

    async function load() {
      const [configRes, userRes] = await Promise.all([
        db.from('configuracoes_agencia').select('logo_url, nome').limit(1).maybeSingle() as Promise<{ data: { logo_url: string | null; nome: string } | null }>,
        supabase.auth.getUser(),
      ])

      if (configRes.data) {
        if (configRes.data.logo_url) setLogoUrl(configRes.data.logo_url)
        if (configRes.data.nome) setAgenciaNome(configRes.data.nome)
      }

      const userId = userRes.data.user?.id
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, avatar_url')
          .eq('id', userId)
          .maybeSingle() as { data: { nome: string | null; avatar_url: string | null } | null }
        if (profile) {
          setUserNome(profile.nome ?? '')
          setUserAvatar(profile.avatar_url ?? null)
        }
      }
    }
    load()
  }, [])

  const supabase = createClient()
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const iniciais = agenciaNome
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'T'

  const userIniciais = userNome
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'U'

  return (
    <aside className="flex h-screen w-60 flex-col bg-brand-noite border-r border-white/[0.06] fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-lima overflow-hidden shrink-0">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={agenciaNome}
              width={32}
              height={32}
              className="object-contain w-full h-full"
              unoptimized
            />
          ) : (
            <span className="text-brand-noite font-black text-sm tracking-tighter">{iniciais[0]}</span>
          )}
        </div>
        <div>
          <span className="text-brand-lavanda font-bold text-base tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {agenciaNome.toLowerCase()}
          </span>
          <p className="text-brand-lavanda/30 text-[10px] leading-none mt-0.5 tracking-wide">gestão</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-100',
                isActive
                  ? 'bg-white/[0.08] text-brand-lavanda'
                  : 'text-brand-lavanda/40 hover:text-brand-lavanda/80 hover:bg-white/[0.04]'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-lima' : 'text-brand-lavanda/30')} />
              <span className={cn('font-medium', isActive ? '' : 'font-normal')}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer user */}
      <div className="border-t border-white/[0.06] px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <Avatar className="h-7 w-7">
            {userAvatar && <AvatarImage src={userAvatar} alt={userNome} />}
            <AvatarFallback className="text-[10px] bg-white/[0.1] text-brand-lavanda/70 font-medium">
              {userIniciais}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-brand-lavanda/80 truncate">{userNome || agenciaNome}</p>
            <p className="text-[10px] text-brand-lavanda/30 truncate">Agência</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-7 w-7 shrink-0 text-brand-lavanda/30 hover:text-brand-lavanda/60"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  )
}

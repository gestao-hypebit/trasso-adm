'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FolderOpen, DollarSign, FileText,
  Settings, LogOut,
  StickyNote, Inbox, Target, Star, Store, ChevronDown, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useMobileNav } from '@/components/layout/mobile-nav'
import { useFrente, frenteOpcoes, type Frente } from '@/components/layout/frente'

type NavItem = {
  href: string
  icon: typeof LayoutDashboard
  label: string
  children?: { href: string; label: string }[]
  // Frentes em que o item aparece. Sem a chave, aparece em todas.
  frentes?: Frente[]
}

const navItems: NavItem[] = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/metas',         icon: Target,          label: 'Metas' },
  { href: '/clientes',      icon: Users,           label: 'Clientes' },
  { href: '/catalogo',      icon: Store,           label: 'Catálogo Place', frentes: ['catalogo_place', 'todas'] },
  { href: '/leads',         icon: Inbox,           label: 'Leads',          frentes: ['agencia', 'todas'] },
  { href: '/projetos',      icon: FolderOpen,      label: 'Projetos',       frentes: ['agencia', 'todas'] },
  { href: '/avaliacoes',    icon: Star,            label: 'Avaliações',     frentes: ['agencia', 'todas'] },
  {
    href: '/financeiro', icon: DollarSign, label: 'Financeiro',
    children: [
      { href: '/financeiro',               label: 'Visão Geral' },
      { href: '/financeiro/receitas',      label: 'Contas a Receber' },
      { href: '/financeiro/despesas',      label: 'Contas a Pagar' },
      { href: '/financeiro/fluxo-de-caixa', label: 'Fluxo de Caixa' },
      { href: '/financeiro/mrr',            label: 'MRR' },
    ],
  },
  { href: '/propostas',     icon: FileText,        label: 'Propostas',      frentes: ['agencia', 'todas'] },
  { href: '/anotacoes',     icon: StickyNote,      label: 'Anotações' },
  { href: '/configuracoes', icon: Settings,        label: 'Configurações' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { aberto, fechar } = useMobileNav()
  const { frente, setFrente } = useFrente()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [agenciaNome, setAgenciaNome] = useState('Trasso')
  const [userNome, setUserNome] = useState('')
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [leadsNovos, setLeadsNovos] = useState(0)
  const [financeiroAberto, setFinanceiroAberto] = useState(false)

  const isPathActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const financeiroItem = navItems.find(i => i.children)!
  const emFinanceiro = financeiroItem.children!.some(c => isPathActive(c.href))

  useEffect(() => {
    if (emFinanceiro) setFinanceiroAberto(true)
  }, [emFinanceiro])

  useEffect(() => {
    const supabase = createClient()
    const db = supabase as any

    async function load() {
      const [configRes, userRes, leadsRes] = await Promise.all([
        db.from('configuracoes_agencia').select('logo_url, nome').limit(1).maybeSingle() as Promise<{ data: { logo_url: string | null; nome: string } | null }>,
        supabase.auth.getUser(),
        db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'novo') as Promise<{ count: number | null }>,
      ])
      setLeadsNovos(leadsRes.count ?? 0)

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
    <>
    {/* Fundo escuro da gaveta no celular */}
    <div
      onClick={fechar}
      className={cn('fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden', aberto ? 'opacity-100' : 'pointer-events-none opacity-0')}
    />
    <aside className={cn(
      'flex h-dvh w-64 md:w-60 flex-col bg-brand-noite border-r border-white/[0.06] fixed left-0 top-0 z-50 md:z-40 transition-transform duration-200',
      aberto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    )}>
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
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar menu"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-brand-lavanda/50 hover:bg-white/[0.06] hover:text-brand-lavanda md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Frente de negócio */}
      <div className="px-3 pt-3">
        <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          {frenteOpcoes.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFrente(f.value)}
              className={cn(
                'rounded-md px-1 py-1.5 text-[11px] font-medium leading-tight transition-colors',
                frente === f.value ? 'bg-brand-lima text-brand-noite' : 'text-brand-lavanda/50 hover:text-brand-lavanda'
              )}
            >
              {f.value === 'catalogo_place' ? 'Catálogo' : f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.filter((i) => !i.frentes || i.frentes.includes(frente)).map(({ href, icon: Icon, label, children }) => {
          if (children) {
            return (
              <div key={href}>
                <button
                  type="button"
                  onClick={() => setFinanceiroAberto(v => !v)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-100',
                    emFinanceiro
                      ? 'text-brand-lavanda'
                      : 'text-brand-lavanda/40 hover:text-brand-lavanda/80 hover:bg-white/[0.04]'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', emFinanceiro ? 'text-brand-lima' : 'text-brand-lavanda/30')} />
                  <span className={cn('font-medium', emFinanceiro ? '' : 'font-normal')}>{label}</span>
                  <ChevronDown className={cn('ml-auto h-3.5 w-3.5 text-brand-lavanda/30 transition-transform', financeiroAberto && 'rotate-180')} />
                </button>
                {financeiroAberto && (
                  <div className="ml-[22px] mt-0.5 mb-1 space-y-0.5 border-l border-white/[0.06] pl-3">
                    {children.map(child => {
                      // Visão Geral só fica ativa na rota exata, senão acenderia em todas as subpáginas
                      const childActive = child.href === '/financeiro' ? pathname === child.href : isPathActive(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'block rounded-md px-2.5 py-2 md:py-1.5 text-[13px] transition-all duration-100',
                            childActive
                              ? 'bg-white/[0.08] text-brand-lavanda font-medium'
                              : 'text-brand-lavanda/40 hover:text-brand-lavanda/80 hover:bg-white/[0.04]'
                          )}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
          const isActive = isPathActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 md:py-2 text-sm transition-all duration-100',
                isActive
                  ? 'bg-white/[0.08] text-brand-lavanda'
                  : 'text-brand-lavanda/40 hover:text-brand-lavanda/80 hover:bg-white/[0.04]'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-lima' : 'text-brand-lavanda/30')} />
              <span className={cn('font-medium', isActive ? '' : 'font-normal')}>{label}</span>
              {href === '/leads' && leadsNovos > 0 && (
                <span className="ml-auto rounded-full bg-brand-lima px-1.5 text-[10px] font-bold leading-4 text-brand-noite">{leadsNovos}</span>
              )}
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
    </>
  )
}

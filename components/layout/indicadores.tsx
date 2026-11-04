'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, BellOff, BellRing, Landmark, TrendingUp } from 'lucide-react'
import { useAviso } from '@/components/ui/toaster'
import { buscarTudo } from '@/lib/anuncios/consulta'
import { hojeISO, pagamentosNovos, resumoRecebido, saldoDaConta, type LancamentoSaldo, type RecebimentoHoje, type ResumoRecebido } from '@/lib/financeiro'
import { liberarSom, somLiberado, tocarSino } from '@/lib/sino'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'

type Indicadores = {
  recebido: ResumoRecebido | null
  faltaMigration: boolean
  saldo: number | null
  sinoLigado: boolean
  sinoLiberado: boolean
  clicarSino: () => void
}

const IndicadoresContext = createContext<Indicadores>({
  recebido: null, faltaMigration: false, saldo: null, sinoLigado: true, sinoLiberado: false, clicarSino: () => {},
})

// O recebido continua sendo consultado com a aba em segundo plano, senão o sino
// não toca enquanto você usa outra coisa. O navegador pode espaçar para 1x por minuto.
const RECEBIDO_A_CADA_MS = 30_000
const SALDO_A_CADA_MS = 60_000
const AVISO_MIGRATION = 'Rode a migration 20261116000000_lancamentos_recebido_em.sql no Supabase para ver este valor.'
const CHAVE_SINO_DESLIGADO = 'slick-sino-desligado'
const CHAVE_SINO_TOCADOS = 'slick-sino-tocados'

const lerArmazenado = (chave: string) => {
  try { return localStorage.getItem(chave) } catch { return null }
}
const gravarArmazenado = (chave: string, valor: string | null) => {
  try {
    if (valor === null) localStorage.removeItem(chave)
    else localStorage.setItem(chave, valor)
  } catch { /* navegador sem armazenamento: só não lembra */ }
}

// Com o painel aberto em várias abas, só a primeira que vê o pagamento toca.
function marcarComoTocados(ids: string[]) {
  let tocados: string[] = []
  try { tocados = JSON.parse(lerArmazenado(CHAVE_SINO_TOCADOS) ?? '[]') } catch { /* valor inválido: recomeça */ }
  const ineditos = ids.filter((id) => !tocados.includes(id))
  gravarArmazenado(CHAVE_SINO_TOCADOS, JSON.stringify([...tocados, ...ineditos].slice(-100)))
  return ineditos.length > 0
}

// Fica no layout porque cada página monta o próprio Header: assim os valores
// não somem a cada troca de tela. Se uma busca falhar, mantém o último valor.
export function IndicadoresProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const avisar = useAviso()
  const [recebido, setRecebido] = useState<ResumoRecebido | null>(null)
  const [faltaMigration, setFaltaMigration] = useState(false)
  const [saldo, setSaldo] = useState<number | null>(null)
  const [sinoLigado, setSinoLigado] = useState(true)
  const [sinoLiberado, setSinoLiberado] = useState(false)
  const sinoLigadoRef = useRef(true)
  const conhecidos = useRef<Set<string> | null>(null)
  const ultimaBusca = useRef(0)

  const carregarSaldo = useCallback(async () => {
    const db = createClient() as any
    const valor = await buscarTudo<LancamentoSaldo>((de, ate) =>
      db.from('lancamentos').select('tipo, valor, status').in('status', ['recebido', 'pago']).order('id').range(de, ate),
    ).then(saldoDaConta, () => null)
    if (valor !== null) setSaldo(valor)
  }, [])

  const carregarRecebido = useCallback(async () => {
    const busca = ++ultimaBusca.current
    const { data, error } = await (createClient() as any).from('lancamentos')
      .select('id, valor, asaas_payment_id')
      .eq('tipo', 'receita').eq('status', 'recebido').eq('recebido_em', hojeISO())
    if (busca !== ultimaBusca.current) return
    setFaltaMigration(error?.code === '42703')
    if (error) return

    const lista = (data ?? []) as RecebimentoHoje[]
    setRecebido(resumoRecebido(lista))

    // A primeira busca só anota o que já tinha entrado: o sino é para o que chegar depois.
    const novos = conhecidos.current ? pagamentosNovos(conhecidos.current, lista) : []
    conhecidos.current = new Set([...(conhecidos.current ?? []), ...lista.map((l) => l.id)])
    if (!novos.length) return

    carregarSaldo()
    if (!marcarComoTocados(novos.map((n) => n.id))) return
    const { quantidade, total } = resumoRecebido(novos)
    avisar(quantidade === 1 ? `Pagamento recebido: ${formatCurrency(total)}` : `${quantidade} pagamentos recebidos: ${formatCurrency(total)}`)
    if (sinoLigadoRef.current) tocarSino()
  }, [avisar, carregarSaldo])

  const carregar = useCallback(() => {
    carregarRecebido()
    carregarSaldo()
  }, [carregarRecebido, carregarSaldo])

  useEffect(() => { carregar() }, [carregar, pathname])

  useEffect(() => {
    const recebidoIntervalo = setInterval(carregarRecebido, RECEBIDO_A_CADA_MS)
    const saldoIntervalo = setInterval(() => { if (!document.hidden) carregarSaldo() }, SALDO_A_CADA_MS)
    window.addEventListener('focus', carregar)
    return () => {
      clearInterval(recebidoIntervalo)
      clearInterval(saldoIntervalo)
      window.removeEventListener('focus', carregar)
    }
  }, [carregar, carregarRecebido, carregarSaldo])

  // Qualquer clique ou tecla no painel libera o som. Fica na janela para rodar
  // depois do onClick do botão do sino, que precisa saber se ainda estava bloqueado.
  useEffect(() => {
    const ligado = lerArmazenado(CHAVE_SINO_DESLIGADO) === null
    sinoLigadoRef.current = ligado
    setSinoLigado(ligado)
    setSinoLiberado(somLiberado())

    const liberar = () => { liberarSom().then(setSinoLiberado) }
    window.addEventListener('click', liberar)
    window.addEventListener('keydown', liberar)
    return () => {
      window.removeEventListener('click', liberar)
      window.removeEventListener('keydown', liberar)
    }
  }, [])

  // Ainda bloqueado: o clique só libera e toca de exemplo. Depois, liga e desliga.
  const clicarSino = useCallback(() => {
    const ligar = !sinoLiberado || !sinoLigado
    sinoLigadoRef.current = ligar
    setSinoLigado(ligar)
    gravarArmazenado(CHAVE_SINO_DESLIGADO, ligar ? null : '1')
    if (ligar) liberarSom().then((ok) => { if (ok) tocarSino() })
  }, [sinoLiberado, sinoLigado])

  return (
    <IndicadoresContext.Provider value={{ recebido, faltaMigration, saldo, sinoLigado, sinoLiberado, clicarSino }}>
      {children}
    </IndicadoresContext.Provider>
  )
}

export function SinoRecebimentos() {
  const { sinoLigado, sinoLiberado, clicarSino } = useContext(IndicadoresContext)
  const bloqueado = !sinoLiberado
  const dica = bloqueado
    ? 'Clique para liberar o som do sino de pagamentos'
    : sinoLigado ? 'Sino de pagamentos ligado. Clique para desligar.' : 'Sino de pagamentos desligado. Clique para ligar.'
  const Icone = bloqueado ? BellRing : sinoLigado ? Bell : BellOff

  return (
    <button
      type="button"
      onClick={clicarSino}
      title={dica}
      aria-label={dica}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]',
        bloqueado ? 'text-yellow-400 motion-safe:animate-pulse' : sinoLigado ? 'text-brand-lima' : 'text-brand-lavanda/40',
      )}
    >
      <Icone className="h-4 w-4" />
    </button>
  )
}

const chip = 'flex h-10 min-w-0 items-center gap-2 rounded-lg px-2.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lavanda'
const rotulo = 'block text-[10px] font-semibold uppercase leading-tight tracking-wide opacity-80'
const valor = 'block truncate text-sm font-bold leading-tight tabular-nums'

export function IndicadoresTopo({ className }: { className?: string }) {
  const { recebido, faltaMigration, saldo } = useContext(IndicadoresContext)
  const quantidade = recebido?.quantidade ?? 0
  const recebeuHoje = quantidade > 0

  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <Link
        href="/financeiro/receitas"
        title={faltaMigration ? AVISO_MIGRATION : 'Tudo que entrou hoje. Nas cobranças do Asaas, já sem a taxa.'}
        className={cn(chip, recebeuHoje ? 'bg-brand-lima text-brand-noite' : 'border border-brand-lima/40 bg-brand-lima/10 text-brand-lima')}
      >
        <TrendingUp className="h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className={rotulo}>Recebido hoje{recebeuHoje && ` · ${quantidade}`}</span>
          <span className={valor}>{recebido ? formatCurrency(recebido.total) : faltaMigration ? '—' : '...'}</span>
        </span>
      </Link>
      <Link
        href="/financeiro/fluxo-de-caixa"
        title="Tudo que foi recebido menos tudo que foi pago"
        className={cn(chip, (saldo ?? 0) < 0 ? 'bg-brand-rosa text-brand-noite' : 'bg-brand-violeta text-white')}
      >
        <Landmark className="h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className={rotulo}>Saldo em conta</span>
          <span className={valor}>{saldo === null ? '...' : formatCurrency(saldo)}</span>
        </span>
      </Link>
    </div>
  )
}

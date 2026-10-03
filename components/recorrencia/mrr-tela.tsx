'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, Check, Info, PlugZap, Settings2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FinanceiroSubNav } from '@/components/financeiro/financeiro-sub-nav'
import { useRecorrencia, type Categoria } from '@/components/recorrencia/use-recorrencia'
import { VisaoGeral } from '@/components/recorrencia/visao-geral'
import { AssinantesLinha } from '@/components/recorrencia/assinantes-linha'
import { LINHA_CORES } from '@/lib/financeiro/linhas'
import { cn } from '@/lib/utils'

export type AbaMrr = 'geral' | 'catalogo' | 'servicos'

const ABAS: { key: AbaMrr; label: string; cor?: string }[] = [
  { key: 'geral', label: 'Visão geral' },
  { key: 'catalogo', label: 'Catálogo Place', cor: LINHA_CORES.catalogo_place },
  { key: 'servicos', label: 'Serviços', cor: LINHA_CORES.agencia },
]

export function MrrTela({ abaInicial }: { abaInicial: AbaMrr }) {
  const pathname = usePathname()
  const r = useRecorrencia()
  const [aba, setAbaState] = useState<AbaMrr>(abaInicial)
  const [configAberta, setConfigAberta] = useState(false)
  const [salvandoCat, setSalvandoCat] = useState<string | null>(null)

  // A aba fica no endereço (?aba=catalogo), então dá para mandar o link direto.
  function setAba(a: AbaMrr) {
    setAbaState(a)
    const url = a === 'geral' ? pathname : `${pathname}?aba=${a}`
    window.history.replaceState(null, '', url)
  }

  async function alternar(c: Categoria) {
    setSalvandoCat(c.id)
    await r.alternarCategoria(c)
    setSalvandoCat(null)
  }

  const marcadas = r.categorias.filter((c) => c.recorrente)

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Financeiro" description="Receita recorrente e assinaturas" />
      <main className="flex-1 p-4 md:p-6">
        <PageHeader title="MRR e assinaturas" description="Receita recorrente da agência: Catálogo Place e Serviços">
          <Button variant="outline" size="sm" asChild><Link href="/catalogo/asaas"><PlugZap className="h-4 w-4" /> Integração Asaas</Link></Button>
          <Button variant="outline" size="sm" onClick={() => setConfigAberta((v) => !v)}><Settings2 className="h-4 w-4" /> Categorias</Button>
        </PageHeader>
        <FinanceiroSubNav pathname={pathname} />

        {r.erro && <p className="mb-4 text-sm text-brand-rosa">{r.erro}</p>}
        {r.erroAsaas && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-4 py-2.5 text-sm text-brand-lavanda/80">
            <span><AlertTriangle className="mr-1.5 inline h-4 w-4 text-yellow-400" />Não deu para buscar as assinaturas no Asaas: {r.erroAsaas}. Os valores estão vindo só dos lançamentos.</span>
            <Button size="sm" variant="ghost" onClick={r.carregarAsaas}>Tentar de novo</Button>
          </div>
        )}
        {!r.asaasCarregando && !r.asaasLigado && (
          <p className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-brand-lavanda/50">
            O Asaas não está configurado no servidor: os valores vêm só dos lançamentos do financeiro. Veja em <Link href="/catalogo/asaas" className="text-brand-lima hover:underline">Integração Asaas</Link>.
          </p>
        )}
        {r.semMigration && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-4 py-3 text-sm text-brand-lavanda/80">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
            <p>
              As categorias de mensalidade estão sendo escolhidas pelo nome. Para poder marcar e desmarcar à vontade,
              rode o arquivo <code className="text-yellow-400">supabase/migrations/20261001000000_categorias_mrr.sql</code> no SQL Editor do Supabase.
            </p>
          </div>
        )}

        {(configAberta || (!r.loading && marcadas.length === 0)) && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quais categorias são mensalidade?</CardTitle>
              <p className="text-xs text-brand-lavanda/40">Só os lançamentos de receita dessas categorias contam como mensalidade (líquido, histórico e clientes fora do Asaas). Projetos e avulsos ficam de fora.</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {r.categorias.length === 0 && <p className="text-xs text-brand-lavanda/40">Nenhuma categoria de receita cadastrada.</p>}
              {r.categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={r.semMigration || salvandoCat === c.id}
                  onClick={() => alternar(c)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed',
                    c.recorrente ? 'border-brand-lima/40 bg-brand-lima/10 text-brand-lima' : 'border-white/[0.1] text-brand-lavanda/50 hover:border-white/[0.2] hover:text-brand-lavanda',
                    salvandoCat === c.id && 'opacity-50'
                  )}
                >
                  {c.recorrente && <Check className="h-3 w-3" />}
                  {c.nome}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Abas */}
        <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 sm:w-fit">
          {ABAS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAba(a.key)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                aba === a.key ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/50 hover:text-brand-lavanda'
              )}
            >
              {a.cor && <span className="h-2 w-2 rounded-sm" style={{ background: a.cor }} />}
              {a.label}
            </button>
          ))}
        </div>

        {r.loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-brand-lavanda/40">Carregando...</div>
        ) : aba === 'geral' ? (
          <VisaoGeral r={r} onAbrir={(l) => setAba(l === 'catalogo_place' ? 'catalogo' : 'servicos')} />
        ) : (
          <AssinantesLinha key={aba} r={r} linha={aba === 'catalogo' ? 'catalogo_place' : 'agencia'} />
        )}
      </main>
    </div>
  )
}

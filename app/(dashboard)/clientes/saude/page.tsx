'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle, Info } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRecorrencia } from '@/components/recorrencia/use-recorrencia'
import { createClient } from '@/lib/supabase/client'
import { LINHAS_SAAS, labelLinha, linhaDoProduto, type LinhaSaas } from '@/lib/financeiro/linhas'
import { saasDoCliente } from '@/lib/recorrencia'
import { cn, formatCurrency } from '@/lib/utils'

type Cliente = {
  id: string; nome: string; email: string | null; cpf_cnpj: string | null; tipo: string; status: string
  produto_id: string | null; asaas_customer_id: string | null
}
type Produto = { id: string; nome: string }

const so = (v: string | null) => (v ?? '').replace(/\D/g, '')

// Tudo o que deixa o MRR, as Metas ou o Asaas errados sem ninguém perceber,
// com a correção ao lado quando dá para corrigir aqui mesmo.
export default function SaudeCadastroPage() {
  const r = useRecorrencia()
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [pendencias, setPendencias] = useState(0)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const db = createClient() as any
    const [c, p, pend] = await Promise.all([
      db.from('clientes').select('id, nome, email, cpf_cnpj, tipo, status, produto_id, asaas_customer_id').order('nome'),
      db.from('produtos').select('id, nome').eq('tipo', 'saas').eq('ativo', true),
      db.from('asaas_pendencias').select('payment_id', { count: 'exact', head: true }).eq('resolvida', false),
    ])
    setClientes(c.data ?? [])
    setProdutos(p.data ?? [])
    setPendencias(pend.count ?? 0)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const produtoDaLinha = (l: LinhaSaas) => produtos.find((p) => linhaDoProduto(p.nome) === l)?.id ?? null

  async function salvar(id: string, mudanca: Partial<Cliente>) {
    setSalvando(id)
    setErro(null)
    const { error } = await (createClient() as any).from('clientes').update(mudanca).eq('id', id)
    setSalvando(null)
    if (error) { setErro(error.message); return }
    await carregar()
    r.recarregarTudo()
  }

  const semProduto = (clientes ?? []).filter((c) => (c.tipo === 'saas' || c.tipo === 'ambos') && !c.produto_id)

  // Mensalidade de um SaaS, mas o cadastro diz outra coisa.
  const cadastroErrado = useMemo(() => LINHAS_SAAS.flatMap((l) =>
    r.porLinha[l].tipoErrado.map((c) => ({ ...c, linha: l, atual: saasDoCliente(c) }))), [r.porLinha])

  const duplicados = useMemo(() => {
    const grupos = new Map<string, Cliente[]>()
    for (const c of clientes ?? []) {
      const chaves = [c.email?.trim().toLowerCase() ? `e:${c.email.trim().toLowerCase()}` : null, so(c.cpf_cnpj).length >= 11 ? `d:${so(c.cpf_cnpj)}` : null]
      for (const k of chaves) if (k) grupos.set(k, [...(grupos.get(k) ?? []), c])
    }
    const vistos = new Set<string>()
    return [...grupos.entries()].filter(([, cs]) => cs.length > 1).filter(([, cs]) => {
      const id = cs.map((c) => c.id).sort().join()
      if (vistos.has(id)) return false
      vistos.add(id)
      return true
    })
  }, [clientes])

  const mensalidadesSemCliente = r.linhas.reduce((s, l) => s + l.semCliente, 0)
  const foraDoAsaas = (clientes ?? []).filter((c) => c.tipo === 'saas' && c.status === 'ativo' && !c.asaas_customer_id)

  const carregando = clientes === null || r.loading
  const problemas = semProduto.length + cadastroErrado.length + duplicados.length + (r.semCliente.qtd ? 1 : 0) + (pendencias ? 1 : 0) + (mensalidadesSemCliente ? 1 : 0)

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Clientes" description="Saúde do cadastro" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Link href="/clientes" className="inline-flex items-center gap-1.5 text-xs text-brand-lavanda/50 hover:text-brand-lavanda">
          <ArrowLeft className="h-3.5 w-3.5" /> Clientes
        </Link>
        <PageHeader
          title="Saúde do cadastro"
          description={carregando ? 'Verificando...' : problemas === 0 ? 'Nada para corrigir.' : `${problemas} ponto(s) para revisar. Cadastro certo = MRR, Metas e Asaas certos.`}
        />
        {erro && <p className="text-sm text-brand-rosa">{erro}</p>}

        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-brand-lavanda/40"><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</div>
        ) : (
          <>
            <Secao
              titulo="Cliente SaaS sem produto"
              ok={semProduto.length === 0}
              explica="Sem produto, o sistema não sabe se é Catálogo Place ou Clubelly e conta como Catálogo. Escolha o produto, ou mude para só Agência se ele não assina nenhum SaaS."
            >
              {semProduto.map((c) => (
                <Linha key={c.id} nome={c.nome} href={`/clientes/${c.id}`} detalhe={c.tipo === 'ambos' ? 'Agência + SaaS' : 'SaaS'}>
                  {LINHAS_SAAS.map((l) => produtoDaLinha(l) && (
                    <Button key={l} size="sm" variant="outline" disabled={salvando === c.id} onClick={() => salvar(c.id, { produto_id: produtoDaLinha(l) })}>{labelLinha(l)}</Button>
                  ))}
                  {c.tipo === 'ambos' && (
                    <Button size="sm" variant="ghost" disabled={salvando === c.id} onClick={() => salvar(c.id, { tipo: 'agencia', produto_id: null })}>Só Agência</Button>
                  )}
                </Linha>
              ))}
            </Secao>

            <Secao
              titulo="Mensalidade de um SaaS, mas o cadastro diz outra coisa"
              ok={cadastroErrado.length === 0}
              explica="Tem lançamento do SaaS no financeiro, mas o cliente está cadastrado só como Agência ou com o outro produto. Corrigir põe o cliente na lista certa do MRR."
            >
              {cadastroErrado.map((c) => (
                <Linha key={`${c.linha}:${c.id}`} nome={c.nome} href={`/clientes/${c.id}`}
                  detalhe={`mensalidade ${labelLinha(c.linha)} · cadastro: ${c.atual ? labelLinha(c.atual) : 'só Agência'}`}>
                  {produtoDaLinha(c.linha) && (
                    <Button size="sm" variant="outline" disabled={salvando === c.id}
                      onClick={() => salvar(c.id, { tipo: c.tipo === 'agencia' ? 'ambos' : c.tipo, produto_id: produtoDaLinha(c.linha) })}>
                      Marcar como {labelLinha(c.linha)}
                    </Button>
                  )}
                </Linha>
              ))}
            </Secao>

            <Secao
              titulo="Assinaturas pagas no Asaas sem cliente"
              ok={r.semCliente.qtd === 0}
              carregando={r.asaasCarregando}
              explica={'Dinheiro entrando que não aparece no MRR. Dá para criar o cliente com os dados do Asaas na lista "Só no Asaas".'}
            >
              {r.semCliente.qtd > 0 && (
                <Linha nome={`${r.semCliente.qtd} assinatura(s) · ${formatCurrency(r.semCliente.valor)}/mês`} href="/financeiro/mrr" detalhe="MRR e assinaturas → Só no Asaas" />
              )}
            </Secao>

            <Secao titulo="Pendências do Asaas" ok={pendencias === 0} explica="Cobranças que a integração não conseguiu ligar sozinha (cliente não encontrado, mais de um lançamento no mês...).">
              {pendencias > 0 && <Linha nome={`${pendencias} pendência(s) aberta(s)`} href="/catalogo/asaas" detalhe="Integração Asaas → Precisa da sua decisão" />}
            </Secao>

            <Secao titulo="Mensalidades lançadas sem cliente" ok={mensalidadesSemCliente === 0}
              explica="Mensalidade identificada só pela descrição do lançamento: não aparece no histórico do cliente nem é cobrada pela régua. Escolha o cliente no lançamento.">
              {mensalidadesSemCliente > 0 && <Linha nome={`${mensalidadesSemCliente} assinante(s) só pela descrição`} href="/financeiro/receitas" detalhe="Contas a Receber" />}
            </Secao>

            <Secao titulo="Possíveis duplicados" ok={duplicados.length === 0} explica="Mesmo e-mail ou CPF/CNPJ em mais de um cliente. Duplicado divide o histórico e atrapalha o Asaas a achar o cliente certo.">
              {duplicados.map(([chave, cs]) => (
                <Linha key={chave} nome={cs.map((c) => c.nome.trim()).join(' · ')} detalhe={chave.startsWith('e:') ? `e-mail ${chave.slice(2)}` : 'mesmo CPF/CNPJ'}>
                  {cs.map((c) => <Button key={c.id} size="sm" variant="ghost" asChild><Link href={`/clientes/${c.id}`}>{c.nome.trim().split(' ')[0]}</Link></Button>)}
                </Linha>
              ))}
            </Secao>

            <Secao titulo="Clientes SaaS ativos fora do Asaas" ok={foraDoAsaas.length === 0} info
              explica="Não é erro se o cliente paga por fora (Pix direto, dinheiro). Se ele tem assinatura no Asaas, ligue para as faturas aparecerem.">
              {foraDoAsaas.map((c) => <Linha key={c.id} nome={c.nome} href={`/clientes/${c.id}`} detalhe={c.produto_id ? produtos.find((p) => p.id === c.produto_id)?.nome : undefined} />)}
            </Secao>
          </>
        )}
      </main>
    </div>
  )
}

function Secao({ titulo, explica, ok, info, carregando, children }: {
  titulo: string; explica: string; ok: boolean; info?: boolean; carregando?: boolean; children?: React.ReactNode
}) {
  return (
    <Card className={cn(!ok && !info && 'border-yellow-400/20')}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {carregando ? <Loader2 className="h-4 w-4 animate-spin text-brand-lavanda/40" />
            : ok ? <CheckCircle2 className="h-4 w-4 text-brand-lima" />
            : info ? <Info className="h-4 w-4 text-brand-violeta" />
            : <AlertTriangle className="h-4 w-4 text-yellow-400" />}
          {titulo}
        </CardTitle>
        <p className="text-xs text-brand-lavanda/40">{explica}</p>
      </CardHeader>
      {!ok && !carregando && <CardContent className="p-0"><ul className="divide-y divide-white/[0.04]">{children}</ul></CardContent>}
    </Card>
  )
}

function Linha({ nome, detalhe, href, children }: { nome: string; detalhe?: string; href?: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
      <div className="min-w-0">
        {href ? <Link href={href} className="text-sm font-medium text-brand-lavanda hover:text-brand-lima">{nome}</Link> : <p className="text-sm font-medium text-brand-lavanda">{nome}</p>}
        {detalhe && <p className="text-xs text-brand-lavanda/40">{detalhe}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </li>
  )
}

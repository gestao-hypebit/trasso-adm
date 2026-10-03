'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hojeISO } from '@/lib/financeiro'
import { montarLinha, assinaturasSemCliente, ativa, type ClienteRec, type Dados, type LancRec } from '@/lib/recorrencia'
import { valorMensal, type AssinaturaAsaas } from '@/lib/asaas/rotulos'

export type Categoria = { id: string; nome: string; recorrente: boolean }

// Usado só enquanto a migration 20261001000000_categorias_mrr.sql não foi aplicada.
const CATEGORIA_MENSALIDADE_RE = /mensal|assinatura|cat[aá]logo|recorr|saas|plano|retainer|fee/i

// Carrega tudo o que a tela de MRR precisa (uma vez para as três abas):
// clientes, receitas das duas linhas, categorias recorrentes e assinaturas do Asaas.
export function useRecorrencia() {
  const [clientes, setClientes] = useState<ClienteRec[]>([])
  const [lancamentos, setLancamentos] = useState<LancRec[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [semMigration, setSemMigration] = useState(false)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [asaas, setAsaas] = useState<{ configurado: boolean; assinaturas: AssinaturaAsaas[] } | null>(null)
  const [erroAsaas, setErroAsaas] = useState<string | null>(null)
  const hoje = hojeISO()

  const carregar = useCallback(async () => {
    const db = createClient() as any
    const campos = 'id, nome, empresa, whatsapp, telefone, status, created_at, tipo'
    const [resClientes, resLanc, resCats] = await Promise.all([
      db.from('clientes').select(`${campos}, asaas_customer_id`).order('nome'),
      db.from('lancamentos')
        .select('valor, data, status, descricao, cliente_id, categoria_id, frente, asaas_payment_id, clientes(nome, whatsapp, telefone), categorias_financeiras(nome)')
        .eq('tipo', 'receita')
        .in('frente', ['catalogo_place', 'agencia']),
      db.from('categorias_financeiras').select('id, nome, recorrente').eq('tipo', 'receita').order('nome'),
    ])

    // Sem a migration do Asaas a coluna não existe: carrega sem ela.
    let cls = resClientes.data
    if (resClientes.error) cls = (await db.from('clientes').select(campos).order('nome')).data

    let lancs = resLanc.data
    if (resLanc.error) {
      const r = await db.from('lancamentos')
        .select('valor, data, status, descricao, cliente_id, categoria_id, frente, clientes(nome, whatsapp, telefone), categorias_financeiras(nome)')
        .eq('tipo', 'receita')
        .in('frente', ['catalogo_place', 'agencia'])
      lancs = r.data
      if (r.error) setErro('Não foi possível carregar as mensalidades. A migration de frentes (20261007000000_frentes.sql) já foi aplicada no Supabase?')
    }

    let cats: Categoria[]
    if (resCats.error) {
      // Coluna `recorrente` ainda não existe: cai no palpite pelo nome.
      const r = await db.from('categorias_financeiras').select('id, nome').eq('tipo', 'receita').order('nome')
      cats = ((r.data ?? []) as { id: string; nome: string }[]).map((c) => ({ ...c, recorrente: CATEGORIA_MENSALIDADE_RE.test(c.nome) }))
      setSemMigration(true)
    } else {
      cats = resCats.data ?? []
      setSemMigration(false)
    }

    setClientes(cls ?? [])
    setLancamentos(lancs ?? [])
    setCategorias(cats)
    setLoading(false)
  }, [])

  // O Asaas é mais lento: carrega à parte para a tela não esperar por ele.
  const carregarAsaas = useCallback(async () => {
    setErroAsaas(null)
    try {
      const r = await fetch('/api/asaas/assinaturas')
      const json = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(json.error ?? `Erro ${r.status}`)
      setAsaas(json)
    } catch (e) {
      setErroAsaas(e instanceof Error ? e.message : 'Falha ao falar com o Asaas.')
      setAsaas({ configurado: true, assinaturas: [] })
    }
  }, [])

  useEffect(() => { carregar(); carregarAsaas() }, [carregar, carregarAsaas])

  const recarregarTudo = useCallback(() => { carregar(); carregarAsaas() }, [carregar, carregarAsaas])

  async function alternarCategoria(c: Categoria) {
    if (semMigration) return
    const { error } = await (createClient() as any).from('categorias_financeiras').update({ recorrente: !c.recorrente }).eq('id', c.id)
    if (!error) await carregar()
  }

  const resultado = useMemo(() => {
    const dados: Dados = {
      clientes,
      lancamentos,
      recorrentes: categorias.filter((c) => c.recorrente).map((c) => c.id),
      assinaturas: asaas?.assinaturas ?? [],
      asaasCarregado: !!asaas?.configurado && !erroAsaas && (asaas?.assinaturas.length ?? 0) > 0,
      hoje,
    }
    const semCliente = assinaturasSemCliente(dados).filter(ativa)
    return {
      dados,
      catalogo: montarLinha('catalogo_place', dados),
      servicos: montarLinha('agencia', dados),
      semCliente: { qtd: semCliente.length, valor: semCliente.reduce((t, s) => t + valorMensal(s), 0) },
    }
  }, [clientes, lancamentos, categorias, asaas, erroAsaas, hoje])

  return {
    ...resultado,
    loading, erro, categorias, semMigration, alternarCategoria,
    asaasCarregando: asaas === null,
    asaasLigado: !!asaas?.configurado,
    erroAsaas,
    carregarAsaas,
    recarregarTudo,
  }
}

export type Recorrencia = ReturnType<typeof useRecorrencia>

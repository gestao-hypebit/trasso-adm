'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hojeISO } from '@/lib/financeiro'
import { resumirRecorrencia, type LinhaRec, type ResultadoLinha } from '@/lib/recorrencia'
import type { Categoria, RespostaRecorrencia } from '@/app/api/recorrencia/route'

export type { Categoria }

// Descrição do serviço por assinante: chave `${linha}:${chave do assinante}`.
const chaveServico = (linha: LinhaRec, chave: string) => `${linha}:${chave}`

// Enquanto a 1ª resposta não chega: tudo zerado, no mesmo formato.
const vazio = (hoje: string) => resumirRecorrencia({ clientes: [], lancamentos: [], recorrentes: [], assinaturas: [], asaasCarregado: false, hoje })

// MRR e assinaturas (uma vez para as três abas). O cálculo é feito no servidor
// (/api/recorrencia): a tela recebe só o resultado. Primeiro vem sem o Asaas
// (rápido), depois com as assinaturas dele.
export function useRecorrencia() {
  const hoje = hojeISO()
  const [resp, setResp] = useState<RespostaRecorrencia | null>(null)
  const [servicos, setServicos] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [erroRede, setErroRede] = useState<string | null>(null)
  const [asaasCarregando, setAsaasCarregando] = useState(true)
  const [erroAsaas, setErroAsaas] = useState<string | null>(null)
  // Ignora respostas de pedidos antigos (ex.: recarregou no meio).
  const pedido = useRef(0)

  const buscar = useCallback(async (comAsaas: boolean): Promise<RespostaRecorrencia> => {
    const r = await fetch(`/api/recorrencia?hoje=${hoje}${comAsaas ? '&asaas=1' : ''}`)
    const json = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(json.error ?? `Erro ${r.status}`)
    return json
  }, [hoje])

  const aplicar = useCallback((r: RespostaRecorrencia) => {
    setResp(r)
    setServicos(new Map(r.servicos.map((s) => [chaveServico(s.linha, s.chave), s.descricao])))
  }, [])

  const carregarAsaas = useCallback(async () => {
    const meu = pedido.current
    setAsaasCarregando(true)
    setErroAsaas(null)
    try {
      const r = await buscar(true)
      if (meu !== pedido.current) return
      aplicar(r)
      setErroAsaas(r.asaas.erro)
    } catch (e) {
      if (meu === pedido.current) setErroAsaas(e instanceof Error ? e.message : 'Falha ao falar com o Asaas.')
    } finally {
      if (meu === pedido.current) setAsaasCarregando(false)
    }
  }, [buscar, aplicar])

  const recarregarTudo = useCallback(async () => {
    const meu = ++pedido.current
    setErroRede(null)
    try {
      const r = await buscar(false)
      if (meu !== pedido.current) return
      aplicar(r)
      setLoading(false)
      if (r.asaas.configurado) await carregarAsaas()
      else setAsaasCarregando(false)
    } catch (e) {
      if (meu !== pedido.current) return
      setErroRede(e instanceof Error ? e.message : 'Falha ao carregar o MRR.')
      setLoading(false)
      setAsaasCarregando(false)
    }
  }, [buscar, aplicar, carregarAsaas])

  useEffect(() => { recarregarTudo() }, [recarregarTudo])

  const semMigration = resp?.semMigration ?? false

  async function alternarCategoria(c: Categoria) {
    if (semMigration) return
    const { error } = await (createClient() as any).from('categorias_financeiras').update({ recorrente: !c.recorrente }).eq('id', c.id)
    if (!error) await recarregarTudo()
  }

  const servicoDe = useCallback((linha: LinhaRec, chave: string) => servicos.get(chaveServico(linha, chave)) ?? null, [servicos])

  // Texto vazio apaga a descrição.
  async function salvarServico(linha: LinhaRec, chave: string, descricao: string) {
    const db = createClient() as any
    const texto = descricao.trim()
    const { error } = texto
      ? await db.from('assinatura_servicos').upsert({ chave, linha, descricao: texto, updated_at: new Date().toISOString() })
      : await db.from('assinatura_servicos').delete().eq('chave', chave).eq('linha', linha)
    if (error) return error.code === '42P01' || error.code === 'PGRST205'
      ? 'Rode a migration 20261020000000_assinatura_servicos.sql no Supabase para guardar o serviço.'
      : error.message
    setServicos((m) => {
      const novo = new Map(m)
      if (texto) novo.set(chaveServico(linha, chave), texto)
      else novo.delete(chaveServico(linha, chave))
      return novo
    })
    return null
  }

  const inicial = useMemo(() => vazio(hoje), [hoje])
  const resumo = resp ?? inicial
  const porLinha = useMemo(() => Object.fromEntries(resumo.linhas.map((l) => [l.linha, l])) as Record<LinhaRec, ResultadoLinha>, [resumo.linhas])

  return {
    hoje: resumo.hoje,
    linhas: resumo.linhas,
    porLinha,
    total: resumo.total,
    semCliente: resumo.semCliente,
    churn: resumo.churn,
    safras: resumo.safras,
    taxas: resp?.taxas ?? null,
    loading,
    erro: erroRede ?? resp?.erro ?? null,
    categorias: resp?.categorias ?? [],
    semMigration, alternarCategoria,
    servicoDe, salvarServico, semTabelaServicos: resp?.semTabelaServicos ?? false,
    asaasCarregando,
    asaasLigado: resp?.asaas.configurado ?? false,
    erroAsaas,
    carregarAsaas,
    recarregarTudo,
  }
}

export type Recorrencia = ReturnType<typeof useRecorrencia>

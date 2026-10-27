import 'server-only'
import { buscarTudo, emBlocos } from '@/lib/anuncios/consulta'
import { campanhas as buscarCampanhas, insightsPorAnuncio, MetaErro, type Contexto, type LinhaInsight } from '@/lib/anuncios/meta'
import { DIAS_POR_BLOCO, DIAS_POR_BLOCO_MENOR, diaSP, janelaHistorico, janelaRecente, limparSegredos, marcaPorPrefixo } from '@/lib/anuncios/regras'

// Sincronização Meta → banco. Roda pelo cron diário e pelo botão "Atualizar agora".
//   1. campanhas (status e orçamento atuais)
//   2. insights por anúncio e dia:
//      - os últimos 7 dias, em toda rodada (o Meta corrige números para trás);
//      - o histórico, de trás para frente em blocos de 30 dias, até os 37 meses
//        que o Meta guarda. Leva algumas rodadas; o mais recente aparece primeiro.
//   3. campanha → marca pelo prefixo (atribuição manual nunca é tocada)
//   4. liga eventos de funil às campanhas
// Se o tempo da execução ou o limite do Meta acabar no meio, fica "parcial" e
// a próxima rodada continua de onde parou. Nada é duplicado (upsert por data + ad_id).

type Conta = { id: string; account_id: string; plataforma: string; historico_desde: string | null; backfill_concluido_em: string | null }

export type ResultadoSync = {
  conta: string
  status: 'ok' | 'parcial' | 'erro' | 'ignorada'
  periodo: { de: string; ate: string } | null
  linhas: number
  campanhas: number
  chamadas: number
  mensagem?: string
}

const MARGEM_MS = 8_000 // folga para gravar o log antes de a Vercel cortar

export async function sincronizarTudo(supabase: any, gatilho: 'cron' | 'manual', duracaoMs: number) {
  const prazo = Date.now() + duracaoMs - MARGEM_MS
  const { data: contas, error } = await supabase
    .from('anuncio_contas')
    .select('id, account_id, plataforma, historico_desde, backfill_concluido_em')
    .eq('ativo', true)
    .eq('plataforma', 'meta') // Google Ads: ainda não implementado
  if (error) throw new Error(error.message)

  const resultados: ResultadoSync[] = []
  for (const conta of (contas ?? []) as Conta[]) resultados.push(await sincronizarConta(supabase, conta, gatilho, prazo))
  return resultados
}

async function sincronizarConta(supabase: any, conta: Conta, gatilho: 'cron' | 'manual', prazo: number): Promise<ResultadoSync> {
  const base = { conta: conta.account_id, periodo: null, linhas: 0, campanhas: 0, chamadas: 0 }

  // Outra execução rodando para a mesma conta (cron + botão ao mesmo tempo): não repete.
  const { data: rodando } = await supabase
    .from('anuncio_sincronizacoes')
    .select('id')
    .eq('conta_id', conta.id)
    .eq('status', 'rodando')
    .gte('iniciado_em', new Date(Date.now() - 3 * 60_000).toISOString())
    .limit(1)
  if (rodando?.length) return { ...base, status: 'ignorada', mensagem: 'Já existe uma sincronização em andamento.' }

  const { data: log, error: erroLog } = await supabase
    .from('anuncio_sincronizacoes')
    .insert({ conta_id: conta.id, gatilho })
    .select('id')
    .single()
  if (erroLog) throw new Error(erroLog.message)

  const ctx: Contexto = { prazo, chamadas: 0 }
  const r = { linhas: 0, campanhas: 0, de: null as string | null, ate: null as string | null }
  let status: 'ok' | 'parcial' | 'erro' = 'ok'
  let mensagem: string | undefined

  try {
    // 1. Campanhas
    const c = await buscarCampanhas(ctx, conta.account_id)
    const agora = new Date().toISOString()
    for (const bloco of emBlocos(c.campanhas)) {
      const { error } = await supabase.from('anuncio_campanhas')
        .upsert(bloco.map((x) => ({ ...x, conta_id: conta.id, atualizado_em: agora })), { onConflict: 'campaign_id' })
      if (error) throw new Error(error.message)
    }
    r.campanhas = c.campanhas.length
    if (c.limite) status = 'parcial'

    // 2. Insights
    const hoje = diaSP(new Date())
    const marcarPeriodo = (j: { de: string; ate: string }) => {
      if (!r.de || j.de < r.de) r.de = j.de
      if (!r.ate || j.ate > r.ate) r.ate = j.ate
    }
    // Busca uma janela inteira; false = parou no limite do Meta (a janela fica para a próxima).
    const rodarJanela = async (j: { de: string; ate: string }) => {
      const inicioJanela = new Date().toISOString()
      for await (const pagina of insightsPorAnuncio(ctx, conta.account_id, j.de, j.ate)) {
        await gravarPagina(supabase, conta.id, pagina.linhas)
        r.linhas += pagina.linhas.length
        if (pagina.limite) return false
      }
      // Janela completa: o que ficou com data dela e não veio de novo foi zerado
      // ou apagado no Meta.
      const { error } = await supabase.from('anuncio_metricas_diarias')
        .delete().eq('conta_id', conta.id).gte('data', j.de).lte('data', j.ate).lt('sincronizado_em', inicioJanela)
      if (error) throw new Error(error.message)
      marcarPeriodo(j)
      return true
    }
    const LIMITE = 'Limite de chamadas do Meta perto do fim; o resto vai na próxima rodada.'

    let desde = conta.historico_desde
    let concluido = !!conta.backfill_concluido_em
    if (status === 'ok' && desde && !(await rodarJanela(janelaRecente(hoje)))) { status = 'parcial'; mensagem = LIMITE }

    let bloco = DIAS_POR_BLOCO
    while (status === 'ok' && !concluido) {
      if (Date.now() > prazo - 15_000) {
        status = 'parcial'
        mensagem = `Carregando o histórico${desde ? ` (já desde ${desde.split('-').reverse().join('/')})` : ''}; continua na próxima rodada.`
        break
      }
      const j = janelaHistorico(hoje, desde, bloco)
      let completa: boolean
      try {
        completa = await rodarJanela(j)
      } catch (e) {
        // Bloco pesado demais para o Meta: tenta de novo com 7 dias.
        if (e instanceof MetaErro && e.muitoDado && bloco > DIAS_POR_BLOCO_MENOR) { bloco = DIAS_POR_BLOCO_MENOR; continue }
        throw e
      }
      if (!completa) { status = 'parcial'; mensagem = LIMITE; break }

      desde = j.de
      concluido = j.fim
      const { error } = await supabase.from('anuncio_contas')
        .update({ historico_desde: desde, backfill_concluido_em: concluido ? new Date().toISOString() : null })
        .eq('id', conta.id)
      if (error) throw new Error(error.message)
    }

    // 3 e 4. Marcas e eventos
    await atribuirMarcas(supabase)
    const { error: erroEventos } = await supabase.rpc('anuncio_resolver_eventos')
    if (erroEventos) throw new Error(erroEventos.message)

    await supabase.from('anuncio_contas').update({ ultima_sync_em: new Date().toISOString() }).eq('id', conta.id)
  } catch (e) {
    const tempoEsgotado = e instanceof MetaErro && e.temporario && Date.now() > prazo
    status = tempoEsgotado ? 'parcial' : 'erro'
    mensagem = limparSegredos(e instanceof Error ? e.message : String(e), [process.env.META_ACCESS_TOKEN])
    console.error(`[anuncios] sync ${conta.account_id}: ${mensagem}`)
  }

  await supabase.from('anuncio_sincronizacoes').update({
    status, mensagem: mensagem ?? null,
    periodo_de: r.de, periodo_ate: r.ate,
    linhas: r.linhas, campanhas: r.campanhas, chamadas: ctx.chamadas,
    finalizado_em: new Date().toISOString(),
  }).eq('id', log.id)

  return { conta: conta.account_id, status, periodo: r.de && r.ate ? { de: r.de, ate: r.ate } : null, linhas: r.linhas, campanhas: r.campanhas, chamadas: ctx.chamadas, mensagem }
}

async function gravarPagina(supabase: any, contaId: string, linhas: LinhaInsight[]) {
  if (!linhas.length) return
  // Campanha que só aparece nos insights (arquivada/excluída): cria o registro
  // para o mapeamento de marca funcionar. Não mexe nas que já existem.
  const novas = new Map(linhas.map((l) => [l.campaign_id, { campaign_id: l.campaign_id, conta_id: contaId, nome: l.campaign_name ?? l.campaign_id }]))
  const { error: e1 } = await supabase.from('anuncio_campanhas').upsert([...novas.values()], { onConflict: 'campaign_id', ignoreDuplicates: true })
  if (e1) throw new Error(e1.message)

  const agora = new Date().toISOString()
  for (const bloco of emBlocos(linhas)) {
    const { error } = await supabase.from('anuncio_metricas_diarias')
      .upsert(bloco.map((l) => ({ ...l, conta_id: contaId, sincronizado_em: agora })), { onConflict: 'data,ad_id' })
    if (error) throw new Error(error.message)
  }
}

// Campanha → marca pelo prefixo do nome. Linhas "manual" ficam como estão.
export async function atribuirMarcas(supabase: any) {
  const [{ data: marcas, error: e1 }, campanhas, mapa] = await Promise.all([
    supabase.from('anuncio_marcas').select('id, prefixos'),
    buscarTudo<{ campaign_id: string; nome: string }>((de, ate) => supabase.from('anuncio_campanhas').select('campaign_id, nome').range(de, ate)),
    buscarTudo<{ campaign_id: string; marca_id: string | null; origem: string }>((de, ate) =>
      supabase.from('anuncio_campanha_marca').select('campaign_id, marca_id, origem').range(de, ate)),
  ])
  if (e1) throw new Error(e1.message)
  const atual = new Map(mapa.map((m) => [m.campaign_id, m]))
  const agora = new Date().toISOString()
  const mudancas = campanhas
    .filter((c) => atual.get(c.campaign_id)?.origem !== 'manual')
    .map((c) => ({ campaign_id: c.campaign_id, marca_id: marcaPorPrefixo(c.nome, marcas ?? []), origem: 'auto', updated_at: agora }))
    .filter((m) => { const a = atual.get(m.campaign_id); return !a || a.marca_id !== m.marca_id })
  for (const bloco of emBlocos(mudancas)) {
    const { error } = await supabase.from('anuncio_campanha_marca').upsert(bloco, { onConflict: 'campaign_id' })
    if (error) throw new Error(error.message)
  }
  return mudancas.length
}

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'
import { ConteudoSchema, EdicaoSchema, type Briefing, type Conteudo, type Edicao } from '@/lib/sites/tipos'
import { SISTEMA_CONTEUDO, SISTEMA_EDICAO, SISTEMA_HTML, descreverBriefing, secoesPedidas } from '@/lib/sites/prompts'

// Chamadas ao Claude do gerador de prévias. A chave vem de ANTHROPIC_API_KEY.

const client = new Anthropic()
const MODELO = 'claude-opus-5-5'

// Se o modelo recusar um pedido (filtro de segurança), a API refaz no modelo
// reserva recomendado em vez de devolver a recusa.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

export class IaErro extends Error {}

export const iaConfigurada = () => !!process.env.ANTHROPIC_API_KEY

const sistema = (texto: string) => [{ type: 'text' as const, text: texto, cache_control: { type: 'ephemeral' as const } }]

function verificarParada(msg: Anthropic.Beta.BetaMessage) {
  if (msg.stop_reason === 'refusal') throw new IaErro('A IA recusou este pedido. Revise o briefing e tente de novo.')
  if (msg.stop_reason === 'max_tokens') throw new IaErro('A resposta da IA ficou grande demais e foi cortada. Tente de novo.')
}

const textoDe = (msg: Anthropic.Beta.BetaMessage) =>
  msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('')

async function pedirJson<S extends z.ZodType>(schema: S, opcoes: { sistema: string; usuario: string; effort: 'low' | 'medium' | 'high'; maxTokens: number }): Promise<z.infer<S>> {
  const stream = client.beta.messages.stream({
    model: MODELO,
    max_tokens: opcoes.maxTokens,
    ...FALLBACK,
    thinking: { type: 'adaptive' },
    output_config: { effort: opcoes.effort, format: betaZodOutputFormat(schema) },
    system: sistema(opcoes.sistema),
    messages: [{ role: 'user', content: opcoes.usuario }],
  })
  const msg = await stream.finalMessage()
  verificarParada(msg)
  const resultado = schema.safeParse(JSON.parse(textoDe(msg)))
  if (!resultado.success) throw new IaErro('A IA devolveu uma resposta fora do formato. Tente de novo.')
  return resultado.data
}

// Etapa 1: os textos do site, para revisar antes do design.
export function gerarConteudo(b: Briefing): Promise<Conteudo> {
  return pedirJson(ConteudoSchema, {
    sistema: SISTEMA_CONTEUDO,
    usuario: `Escreva os textos do site a partir deste briefing.\n\n${descreverBriefing(b)}\n\nSeções pedidas: ${secoesPedidas(b)}`,
    effort: 'medium',
    maxTokens: 16000,
  })
}

// Etapa 2: o site em HTML. Devolve o stream para a tela acompanhar a geração.
// Com `parcial`, a geração anterior foi interrompida (tempo máximo da função):
// a IA recebe o que já escreveu e continua do ponto exato, sem recomeçar.
export function gerarHtml(b: Briefing, conteudo: Conteudo, parcial?: string | null) {
  const pedido = `Crie a prévia do site.

Briefing:
${descreverBriefing(b, { visual: true })}

Textos aprovados (JSON):
${JSON.stringify(conteudo, null, 2)}

Ano atual: ${new Date().getFullYear()}`
  const continuacao = parcial
    ? `

Você já começou este HTML e a escrita foi interrompida. Abaixo está tudo o que já foi escrito, entre as marcas INICIO e FIM (as marcas não fazem parte do HTML).

INICIO
${parcial}
FIM

Continue exatamente a partir do último caractere antes de FIM, mantendo o mesmo design. Escreva só o que falta até </html>: não repita nada do que já está escrito, não recomece o documento e não use cercas de markdown.`
    : ''
  return client.beta.messages.stream({
    model: MODELO,
    max_tokens: 64000,
    ...FALLBACK,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: sistema(SISTEMA_HTML),
    messages: [{ role: 'user', content: pedido + continuacao }],
  })
}

// Junta a continuação ao que já existia, descartando o trecho que a IA
// eventualmente repetiu no começo da continuação.
export function juntarContinuacao(base: string, continuacao: string) {
  const resto = continuacao.replace(/^\s*```(?:html)?[^\S\n]*\n?/i, '')
  for (let k = Math.min(2000, base.length, resto.length); k >= 20; k--) {
    if (base.endsWith(resto.slice(0, k))) return base + resto.slice(k)
  }
  return base + resto
}

export function verificarResposta(msg: Anthropic.Beta.BetaMessage) {
  verificarParada(msg)
  return textoDe(msg)
}

// Tira cercas de markdown e qualquer texto fora do documento.
export function limparHtml(texto: string) {
  const inicio = texto.search(/<!DOCTYPE html>|<html/i)
  const fim = texto.toLowerCase().lastIndexOf('</html>')
  if (inicio === -1 || fim === -1) throw new IaErro('A IA não devolveu um HTML completo. Tente gerar de novo.')
  return texto.slice(inicio, fim + '</html>'.length)
}

function aplicarEdicoes(html: string, edicoes: Edicao['edicoes']) {
  let atual = html
  const falhas: string[] = []
  for (const e of edicoes) {
    const primeira = atual.indexOf(e.procurar)
    if (!e.procurar || primeira === -1) { falhas.push(`não encontrado: ${e.procurar.slice(0, 120)}`); continue }
    if (atual.indexOf(e.procurar, primeira + 1) !== -1) { falhas.push(`aparece mais de uma vez: ${e.procurar.slice(0, 120)}`); continue }
    atual = atual.slice(0, primeira) + e.substituir + atual.slice(primeira + e.procurar.length)
  }
  return { html: atual, falhas }
}

// Ajuste por conversa: a IA devolve só os trechos a trocar. Se algum trecho
// não bater com o HTML, pede de novo uma vez mostrando o que falhou.
export async function editarHtml(html: string, instrucao: string, b: Briefing) {
  const base = `Briefing da empresa (para contexto):\n${descreverBriefing(b, { visual: true })}\n\nHTML atual:\n${html}\n\nPedido de alteração: ${instrucao}`
  let pedido = base
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = await pedirJson(EdicaoSchema, { sistema: SISTEMA_EDICAO, usuario: pedido, effort: 'medium', maxTokens: 32000 })
    if (!r.edicoes.length) throw new IaErro('A IA não encontrou o que alterar. Tente descrever o pedido de outro jeito.')
    const { html: novo, falhas } = aplicarEdicoes(html, r.edicoes)
    if (!falhas.length) return { html: novo, resumo: r.resumo }
    pedido = `${base}\n\nSua resposta anterior tinha trechos em "procurar" que não batem com o HTML atual:\n${falhas.map((f) => `- ${f}`).join('\n')}\nRefaça todas as edições copiando os trechos exatamente do HTML acima.`
  }
  throw new IaErro('Não consegui aplicar a alteração. Tente descrever o pedido de outro jeito.')
}

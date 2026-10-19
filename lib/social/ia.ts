import 'server-only'
import { pedirJson } from '@/lib/sites/ia'
import { FORMATOS, REDES, PautaSchema, nomePeriodo, type Pauta } from '@/lib/social/tipos'

// Sugestão de pauta do período (usa a mesma integração com o Claude das prévias de site).

const SISTEMA_PAUTA = `Você é estrategista de social media sênior da Slick, uma agência brasileira. Você monta o planejamento mensal de conteúdo de um cliente: o que postar, quando e em qual formato, com a legenda pronta para revisão.

O que importa:
- Português do Brasil natural, no tom da marca do cliente. Legendas com gancho forte na primeira linha, parágrafos curtos e uma chamada para ação no fim.
- Específico do negócio: fale dos produtos, serviços, público e cidade do cliente. Evite conteúdo genérico que serviria para qualquer empresa.
- Mix equilibrado ao longo do período: conteúdo que educa, que gera conexão/bastidores, prova social e venda. Varie os formatos pedidos.
- Use datas comemorativas do período só quando fizerem sentido para o negócio.
- Distribua os posts nos dias e horários de mais engajamento (evite empilhar no mesmo dia, salvo stories).
- "roteiro" é o que o designer ou videomaker precisa: para carrossel, o texto de cada slide (Slide 1: ..., Slide 2: ...); para reels/vídeo, o roteiro em cenas com a fala; para post e stories, a descrição da arte e o texto que vai nela.
- Não invente fatos como verdade (preços, números, prêmios, depoimentos). Quando precisar de um dado que não foi dado, use um marcador entre colchetes, por exemplo "[preço]".
- De 5 a 12 hashtags relevantes por post, misturando amplas e de nicho/local.`

export type PedidoPauta = {
  mes: string
  fim: string
  quantidade: number
  formatos: string[]
  redes: string[]
  cliente: { nome: string; empresa: string | null; segmento: string | null; cidade: string | null; observacoes: string | null }
  objetivo: string | null
  contexto: string
  existentes: { data: string; titulo: string }[]
}

export function sugerirPauta(p: PedidoPauta): Promise<Pauta> {
  const linhas = [
    `Cliente: ${p.cliente.empresa || p.cliente.nome}`,
    p.cliente.segmento && `Segmento: ${p.cliente.segmento}`,
    p.cliente.cidade && `Cidade: ${p.cliente.cidade}`,
    p.cliente.observacoes && `Sobre o cliente: ${p.cliente.observacoes}`,
    p.objetivo && `Objetivo do mês: ${p.objetivo}`,
    p.contexto && `Orientações da agência: ${p.contexto}`,
    `Período: ${nomePeriodo(p.mes, p.fim)} (de ${p.mes} a ${p.fim}, todas as datas dentro dele)`,
    `Redes: ${p.redes.map((r) => REDES[r as keyof typeof REDES]?.label ?? r).join(', ')}`,
    `Formatos a usar: ${p.formatos.map((f) => `${f} (${FORMATOS[f as keyof typeof FORMATOS]?.label ?? f})`).join(', ')}`,
    `Quantidade de posts: ${p.quantidade}`,
    p.existentes.length
      ? `Já planejados (não repita o tema nem o dia):\n${p.existentes.map((e) => `- ${e.data}: ${e.titulo}`).join('\n')}`
      : null,
  ].filter(Boolean)

  return pedirJson(PautaSchema, {
    sistema: SISTEMA_PAUTA,
    usuario: `Monte a pauta de social media.\n\n${linhas.join('\n')}`,
    effort: 'medium',
    maxTokens: 32000,
  })
}

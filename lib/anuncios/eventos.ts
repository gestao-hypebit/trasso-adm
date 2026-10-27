import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { TIPOS_EVENTO } from '@/lib/anuncios/regras'

// Chave de API de cada marca: mostrada uma vez, guardada só como SHA-256.
export const gerarChave = () => `slk_${randomBytes(24).toString('base64url')}`
export const hashChave = (chave: string) => createHash('sha256').update(chave).digest('hex')

const texto = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null)

export const eventoSchema = z.object({
  marca: z.string().trim().min(1).max(60),
  evento_id: texto(120),
  tipo: z.enum(TIPOS_EVENTO as [string, ...string[]]),
  cliente_id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(120)),
  data: z.string().trim().min(10).max(40),
  valor: z.union([z.number(), z.string()]).optional().nullable().transform((v) => (v === null || v === undefined || v === '' ? null : Number(v))),
  utm_source: texto(100),
  utm_campaign: texto(200),
  utm_content: texto(200),
  ad_id: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v === null || v === undefined || v === '' ? null : String(v).trim())),
}).superRefine((e, ctx) => {
  if (e.valor !== null && (!Number.isFinite(e.valor) || e.valor < 0)) ctx.addIssue({ code: 'custom', path: ['valor'], message: 'valor inválido' })
  if (e.tipo === 'assinatura' && e.valor === null) ctx.addIssue({ code: 'custom', path: ['valor'], message: 'assinatura precisa de valor' })
  if (e.ad_id && !/^\d{6,30}$/.test(e.ad_id)) ctx.addIssue({ code: 'custom', path: ['ad_id'], message: 'ad_id deve ser o id numérico do anúncio' })
  if (!instante(e.data)) ctx.addIssue({ code: 'custom', path: ['data'], message: 'data deve ser ISO 8601 (ex.: 2026-10-27T14:30:00-03:00)' })
})

export type EventoEntrada = z.infer<typeof eventoSchema>

// "2026-10-27" vale como meia-noite em São Paulo; data-hora sem fuso também.
export function instante(data: string): string | null {
  let s = data
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = `${s}T00:00:00-03:00`
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s = `${s}-03:00`
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const numerico = (v: string | null) => (v && /^\d{6,30}$/.test(v) ? v : null)

// Evento validado → linha de funil_eventos. Sem ad_id, um utm_content numérico
// é o id do anúncio ({{ad.id}}) e um utm_campaign numérico o da campanha ({{campaign.id}}).
export function paraLinha(e: EventoEntrada, marcaId: string) {
  const ocorrido = instante(e.data)!
  return {
    marca_id: marcaId,
    evento_id: e.evento_id ?? `${e.tipo}:${e.cliente_id}:${ocorrido}`,
    tipo: e.tipo,
    cliente_ref: e.cliente_id,
    ocorrido_em: ocorrido,
    valor: e.valor,
    utm_source: e.utm_source,
    utm_campaign: e.utm_campaign,
    utm_content: e.utm_content,
    ad_id: e.ad_id ?? numerico(e.utm_content),
    campaign_id: numerico(e.utm_campaign),
  }
}

// Estrutura editável de um site de cliente e limpeza do conteúdo.
//
// Cada site declara as próprias seções e campos (e os textos padrão) e serve
// isso em GET https://<site>/api/slick/schema. O painel guarda essa estrutura
// em site_conteudos.estrutura e monta o editor a partir dela. O conteúdo é
// { [secao]: { [campo]: valor } }; listas são arrays de { _id, ...subcampos }.
// Código puro: roda no navegador (editor) e no servidor (antes de gravar).

export type TipoCampo = 'texto' | 'textarea' | 'imagem' | 'link' | 'lista'
export type TipoSubcampo = Exclude<TipoCampo, 'lista'>

export type CampoBase = {
  id: string
  rotulo: string
  ajuda?: string
  max?: number          // caracteres (texto/textarea)
}

export type Subcampo = CampoBase & { tipo: TipoSubcampo; padrao?: string }

export type CampoLista = CampoBase & {
  tipo: 'lista'
  itemRotulo?: string   // "Depoimento", "Pergunta"...
  min?: number
  maxItens?: number
  campos: Subcampo[]
  padrao?: ItemLista[]
}

export type Campo = (CampoBase & { tipo: TipoSubcampo; padrao?: string }) | CampoLista

export type Secao = { id: string; titulo: string; descricao?: string; campos: Campo[] }
export type Estrutura = { versao: number; secoes: Secao[] }

export type ItemLista = { _id: string; [campo: string]: string }
export type ValorCampo = string | ItemLista[]
export type Conteudo = Record<string, Record<string, ValorCampo>>

const ID_RE = /^[a-z][a-z0-9_]{0,40}$/
const TIPOS: TipoCampo[] = ['texto', 'textarea', 'imagem', 'link', 'lista']
const MAX_PADRAO: Record<TipoSubcampo, number> = { texto: 300, textarea: 5000, imagem: 1000, link: 500 }
const LIMITE_LISTA = 50

export const tipoCampoLabel: Record<TipoCampo, string> = {
  texto: 'Texto curto', textarea: 'Texto', imagem: 'Imagem', link: 'Link', lista: 'Lista',
}

export function limiteCampo(c: { tipo: TipoSubcampo; max?: number }) {
  return Math.min(c.max ?? MAX_PADRAO[c.tipo], MAX_PADRAO[c.tipo])
}

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : undefined)

// ------------------------------------------------------------------
// Estrutura vinda do site: confere tudo antes de guardar.
// ------------------------------------------------------------------

function validarSubcampo(c: unknown, onde: string): Subcampo {
  if (!c || typeof c !== 'object') throw new Error(`${onde}: campo inválido`)
  const o = c as Record<string, unknown>
  const id = String(o.id ?? '')
  if (!ID_RE.test(id)) throw new Error(`${onde}: id "${id}" inválido (use minúsculas, números e _)`)
  const tipo = o.tipo as TipoSubcampo
  if (!TIPOS.includes(tipo) || tipo === ('lista' as TipoCampo)) throw new Error(`${onde}.${id}: tipo "${String(o.tipo)}" inválido`)
  return {
    id, tipo,
    rotulo: str(o.rotulo, 120) || id,
    ajuda: str(o.ajuda, 300),
    max: typeof o.max === 'number' && o.max > 0 ? Math.floor(o.max) : undefined,
    padrao: str(o.padrao, MAX_PADRAO[tipo]),
  }
}

export function validarEstrutura(bruto: unknown): Estrutura {
  if (!bruto || typeof bruto !== 'object') throw new Error('Estrutura inválida.')
  const secoesBrutas = (bruto as { secoes?: unknown }).secoes
  if (!Array.isArray(secoesBrutas) || secoesBrutas.length === 0) throw new Error('A estrutura não tem seções.')
  if (secoesBrutas.length > 40) throw new Error('Seções demais (máx. 40).')

  const idsSecao = new Set<string>()
  const secoes: Secao[] = secoesBrutas.map((s, i) => {
    const o = (s ?? {}) as Record<string, unknown>
    const id = String(o.id ?? '')
    if (!ID_RE.test(id)) throw new Error(`Seção ${i + 1}: id "${id}" inválido`)
    if (idsSecao.has(id)) throw new Error(`Seção "${id}" repetida`)
    idsSecao.add(id)
    if (!Array.isArray(o.campos) || o.campos.length === 0) throw new Error(`Seção "${id}" sem campos`)

    const idsCampo = new Set<string>()
    const campos: Campo[] = o.campos.slice(0, 60).map((c: unknown) => {
      const co = (c ?? {}) as Record<string, unknown>
      let campo: Campo
      if (co.tipo === 'lista') {
        const cid = String(co.id ?? '')
        if (!ID_RE.test(cid)) throw new Error(`${id}: id "${cid}" inválido`)
        if (!Array.isArray(co.campos) || co.campos.length === 0) throw new Error(`${id}.${cid}: lista sem campos`)
        const sub = co.campos.slice(0, 20).map((x: unknown) => validarSubcampo(x, `${id}.${cid}`))
        const maxItens = typeof co.maxItens === 'number' ? Math.min(Math.max(1, Math.floor(co.maxItens)), LIMITE_LISTA) : LIMITE_LISTA
        const min = typeof co.min === 'number' ? Math.min(Math.max(0, Math.floor(co.min)), maxItens) : 0
        const lista: CampoLista = {
          id: cid, tipo: 'lista',
          rotulo: str(co.rotulo, 120) || cid,
          ajuda: str(co.ajuda, 300),
          itemRotulo: str(co.itemRotulo, 60),
          min, maxItens,
          campos: sub,
        }
        lista.padrao = limparLista(lista, co.padrao)
        campo = lista
      } else {
        campo = validarSubcampo(co, id)
      }
      if (idsCampo.has(campo.id)) throw new Error(`${id}: campo "${campo.id}" repetido`)
      idsCampo.add(campo.id)
      return campo
    })

    return { id, titulo: str(o.titulo, 80) || id, descricao: str(o.descricao, 300), campos }
  })

  return { versao: 1, secoes }
}

// ------------------------------------------------------------------
// Conteúdo: só o que a estrutura prevê, com limites. Nada de HTML: o site
// renderiza como texto (com *destaque* e **negrito** interpretados lá).
// ------------------------------------------------------------------

const LINK_OK = /^(https?:\/\/|mailto:|tel:|#|\/)/i

function limparValor(tipo: TipoSubcampo, max: number, v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  // Tira caracteres de controle (mantém quebra de linha e tab).
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  if (tipo === 'texto') return s.replace(/[\r\n]+/g, ' ').slice(0, max)
  if (tipo === 'textarea') return s.replace(/\r\n/g, '\n').slice(0, max)
  const t = s.trim().slice(0, max)
  if (!t) return ''
  if (tipo === 'link') return LINK_OK.test(t) ? t : undefined
  // imagem: só https (Storage) ou caminho local do próprio site
  return /^https:\/\//i.test(t) || t.startsWith('/') ? t : undefined
}

let seq = 0
export function novoIdItem() {
  seq = (seq + 1) % 1e6
  return `${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function limparLista(campo: CampoLista, v: unknown): ItemLista[] | undefined {
  if (!Array.isArray(v)) return undefined
  const ids = new Set<string>()
  return v.slice(0, campo.maxItens ?? LIMITE_LISTA).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const o = item as Record<string, unknown>
    let _id = typeof o._id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(o._id) ? o._id : novoIdItem()
    if (ids.has(_id)) _id = novoIdItem()
    ids.add(_id)
    const limpo: ItemLista = { _id }
    for (const sub of campo.campos) {
      const val = limparValor(sub.tipo, limiteCampo(sub), o[sub.id])
      if (val !== undefined) limpo[sub.id] = val
    }
    return [limpo]
  })
}

export function limparConteudo(estrutura: Estrutura, bruto: unknown): Conteudo {
  const out: Conteudo = {}
  const fonte = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  for (const secao of estrutura.secoes) {
    const vs = (fonte[secao.id] && typeof fonte[secao.id] === 'object' ? fonte[secao.id] : {}) as Record<string, unknown>
    const limpo: Record<string, ValorCampo> = {}
    for (const campo of secao.campos) {
      if (!(campo.id in vs)) continue
      const val = campo.tipo === 'lista' ? limparLista(campo, vs[campo.id]) : limparValor(campo.tipo, limiteCampo(campo), vs[campo.id])
      if (val !== undefined) limpo[campo.id] = val
    }
    if (Object.keys(limpo).length > 0) out[secao.id] = limpo
  }
  return out
}

// Valor que o editor mostra: o salvo ou, se não houver, o padrão do site.
export function valorAtual(conteudo: Conteudo, secao: Secao, campo: Campo): ValorCampo {
  const v = conteudo[secao.id]?.[campo.id]
  if (v !== undefined) return v
  if (campo.tipo === 'lista') return (campo.padrao ?? []).map((i) => ({ ...i }))
  return campo.padrao ?? ''
}

// Problemas que impedem publicar (lista abaixo do mínimo).
export function problemasConteudo(estrutura: Estrutura, conteudo: Conteudo): string[] {
  const erros: string[] = []
  for (const s of estrutura.secoes) {
    for (const c of s.campos) {
      if (c.tipo !== 'lista' || !c.min) continue
      const n = (valorAtual(conteudo, s, c) as ItemLista[]).length
      if (n < c.min) erros.push(`${s.titulo} › ${c.rotulo}: precisa de pelo menos ${c.min}.`)
    }
  }
  return erros
}

export function igual(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

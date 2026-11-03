// Leads dos sites dos clientes: tipos, status e validação do que o site envia.
// Usado pela rota pública (/api/publico/sites/leads), pelo administrativo e pelo portal.

export const siteLeadStatusConfig = {
  novo:       { label: 'Novo',       variant: 'destaque' as const },
  em_contato: { label: 'Em contato', variant: 'pendente' as const },
  convertido: { label: 'Fechou',     variant: 'aprovada' as const },
  descartado: { label: 'Descartado', variant: 'inativo' as const },
}
export type SiteLeadStatus = keyof typeof siteLeadStatusConfig
export const SITE_LEAD_STATUS = Object.keys(siteLeadStatusConfig) as SiteLeadStatus[]

export type SiteLeadResposta = { chave: string; rotulo: string; valor: string | string[] }

export type SiteLead = {
  id: string
  site_id: string
  formulario: string
  nome: string
  email: string | null
  telefone: string | null
  respostas: SiteLeadResposta[]
  status: SiteLeadStatus
  pagina: string | null
  utm: Record<string, string> | null
  created_at: string
}

export const SITE_LEAD_SELECT = 'id, site_id, formulario, nome, email, telefone, respostas, status, pagina, utm, created_at'

export type SiteCliente = {
  id: string
  cliente_id: string
  nome: string
  dominio: string | null
  repositorio: string | null
  chave_prefixo: string | null
  chave_criada_em: string | null
  ativo: boolean
  observacoes: string | null
  created_at: string
}

export const SITE_SELECT = 'id, cliente_id, nome, dominio, repositorio, chave_prefixo, chave_criada_em, ativo, observacoes, created_at'

// O que o site manda no POST.
export type SiteLeadPayload = {
  formulario?: string
  nome?: unknown
  email?: unknown
  telefone?: unknown
  // Demais campos: { chave: valor } ou [{ chave, rotulo, valor }].
  campos?: unknown
  pagina?: unknown
  utm?: Record<string, unknown>
  // Armadilha para robô: campo escondido no formulário. Preenchido = spam.
  _hp?: unknown
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_CAMPOS = 30
const MAX_VALOR = 5000

const texto = (v: unknown, max: number) =>
  typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : ''

function slugSimples(v: unknown, padrao: string) {
  const s = texto(v, 50).toLowerCase().replace(/[^a-z0-9-_]/g, '')
  return s || padrao
}

function rotuloDaChave(chave: string) {
  const s = chave.replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function valorCampo(v: unknown): string | string[] | null {
  if (Array.isArray(v)) {
    const lista = v.map((x) => texto(x, 500)).filter(Boolean).slice(0, 50)
    return lista.length ? lista : null
  }
  const s = texto(v, MAX_VALOR)
  return s || null
}

function normalizarCampos(campos: unknown): SiteLeadResposta[] {
  const out: SiteLeadResposta[] = []
  if (Array.isArray(campos)) {
    for (const c of campos) {
      if (!c || typeof c !== 'object') continue
      const { chave, rotulo, valor } = c as Record<string, unknown>
      const k = slugSimples(chave, '')
      const v = valorCampo(valor)
      if (!k || v === null) continue
      out.push({ chave: k, rotulo: texto(rotulo, 200) || rotuloDaChave(k), valor: v })
    }
  } else if (campos && typeof campos === 'object') {
    for (const [chave, valor] of Object.entries(campos as Record<string, unknown>)) {
      const k = slugSimples(chave, '')
      const v = valorCampo(valor)
      if (!k || v === null) continue
      out.push({ chave: k, rotulo: rotuloDaChave(k), valor: v })
    }
  }
  return out.slice(0, MAX_CAMPOS)
}

export type ResultadoSiteLead =
  | { ok: true; spam: boolean; lead: { formulario: string; nome: string; email: string | null; telefone: string | null; respostas: SiteLeadResposta[]; pagina: string | null } }
  | { ok: false; erros: Record<string, string> }

export function validarSiteLead(body: SiteLeadPayload): ResultadoSiteLead {
  const erros: Record<string, string> = {}
  const nome = texto(body.nome, 200)
  const email = texto(body.email, 200).toLowerCase()
  const telefone = texto(body.telefone, 40)

  if (!nome) erros.nome = 'Informe o nome.'
  if (email && !EMAIL_RE.test(email)) erros.email = 'E-mail inválido.'
  if (!email && !telefone) erros.telefone = 'Informe um e-mail ou telefone.'
  if (telefone && telefone.replace(/\D/g, '').length < 8) erros.telefone = 'Telefone inválido.'
  if (Object.keys(erros).length > 0) return { ok: false, erros }

  return {
    ok: true,
    spam: texto(body._hp, 200) !== '',
    lead: {
      formulario: slugSimples(body.formulario, 'contato'),
      nome,
      email: email || null,
      telefone: telefone || null,
      respostas: normalizarCampos(body.campos),
      pagina: texto(body.pagina, 500) || null,
    },
  }
}

export function valorResposta(v: string | string[]) {
  return Array.isArray(v) ? v.join(', ') : v
}

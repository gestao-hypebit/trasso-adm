// Modelo dos formulários de captação e validação das respostas.
// Usado pelo construtor (/leads/formularios) e pela rota pública que o site chama.

export type CampoTipo = 'texto' | 'email' | 'telefone' | 'textarea' | 'select' | 'opcoes' | 'multiplas'

export type Campo = {
  id: string
  chave: string
  rotulo: string
  tipo: CampoTipo
  placeholder?: string
  obrigatorio: boolean
  largura: 'metade' | 'inteira'
  opcoes?: string[]
}

export type Formulario = {
  id: string
  slug: string
  nome: string
  titulo: string | null
  subtitulo: string | null
  botao_texto: string
  mensagem_sucesso: string
  campos: Campo[]
  ativo: boolean
  created_at: string
  updated_at: string
}

export type Resposta = { chave: string; rotulo: string; valor: string | string[] }

export const campoTipoOpcoes: { value: CampoTipo; label: string; descricao: string }[] = [
  { value: 'texto',     label: 'Texto curto',       descricao: 'Uma linha' },
  { value: 'textarea',  label: 'Texto longo',       descricao: 'Várias linhas' },
  { value: 'email',     label: 'E-mail',            descricao: 'Valida o formato' },
  { value: 'telefone',  label: 'Telefone',          descricao: 'Com máscara (11) 91234-5678' },
  { value: 'opcoes',    label: 'Escolha única',     descricao: 'Botões, escolhe um' },
  { value: 'multiplas', label: 'Múltipla escolha',  descricao: 'Botões, escolhe vários' },
  { value: 'select',    label: 'Lista suspensa',    descricao: 'Dropdown' },
]

export const tiposComOpcoes: CampoTipo[] = ['opcoes', 'multiplas', 'select']

// O campo "nome" é fixo: todo lead precisa de um nome.
export const CHAVE_NOME = 'nome'

// Etapas do funil, na ordem. "convertido" = venda fechada, "descartado" = perdido.
export const leadStatusConfig = {
  novo:        { label: 'Novo',                 variant: 'lead' as const },
  em_contato:  { label: 'Em contato',           variant: 'pendente' as const },
  qualificado: { label: 'Reunião / qualificado', variant: 'default' as const },
  proposta:    { label: 'Proposta enviada',     variant: 'outline' as const },
  convertido:  { label: 'Fechado',              variant: 'aprovada' as const },
  descartado:  { label: 'Perdido',              variant: 'inativo' as const },
}
export type LeadStatus = keyof typeof leadStatusConfig

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function novoCampo(tipo: CampoTipo = 'texto'): Campo {
  const id = Math.random().toString(36).slice(2, 10)
  return {
    id,
    chave: `campo_${id}`,
    rotulo: 'Nova pergunta',
    tipo,
    placeholder: '',
    obrigatorio: false,
    largura: 'inteira',
    opcoes: tiposComOpcoes.includes(tipo) ? ['Opção 1', 'Opção 2'] : undefined,
  }
}

export function camposPadrao(): Campo[] {
  return [
    { id: 'nome', chave: 'nome', rotulo: 'Seu nome', tipo: 'texto', placeholder: 'Como podemos te chamar?', obrigatorio: true, largura: 'metade' },
    { id: 'email', chave: 'email', rotulo: 'Seu e-mail', tipo: 'email', placeholder: 'voce@empresa.com', obrigatorio: true, largura: 'metade' },
    { id: 'telefone', chave: 'telefone', rotulo: 'WhatsApp', tipo: 'telefone', placeholder: '(11) 91234-5678', obrigatorio: true, largura: 'metade' },
    { id: 'mensagem', chave: 'mensagem', rotulo: 'Sobre o projeto', tipo: 'textarea', placeholder: 'Conta rapidamente o que você tem em mente', obrigatorio: true, largura: 'inteira' },
  ]
}

// Problemas que impedem salvar o formulário no construtor.
export function validarEstrutura(campos: Campo[]): string | null {
  if (!campos.some((c) => c.chave === CHAVE_NOME)) return 'O formulário precisa do campo "nome".'
  if (!campos.some((c) => c.tipo === 'email' || c.tipo === 'telefone')) {
    return 'Inclua pelo menos um campo de e-mail ou telefone — senão não tem como responder o lead.'
  }
  for (const c of campos) {
    if (!c.rotulo.trim()) return 'Todo campo precisa de um rótulo.'
    if (tiposComOpcoes.includes(c.tipo) && (c.opcoes ?? []).filter((o) => o.trim()).length < 2) {
      return `"${c.rotulo}" precisa de pelo menos duas opções.`
    }
  }
  return null
}

export type ResultadoValidacao =
  | { ok: true; lead: { nome: string; email: string | null; telefone: string | null; empresa: string | null }; respostas: Resposta[] }
  | { ok: false; erros: Record<string, string> }

// Valida o que o visitante enviou contra a definição do formulário.
// Valores chegam como string ou string[] (múltipla escolha).
export function validarRespostas(campos: Campo[], valores: Record<string, unknown>): ResultadoValidacao {
  const erros: Record<string, string> = {}
  const respostas: Resposta[] = []

  for (const campo of campos) {
    const bruto = valores[campo.chave]
    let valor: string | string[]

    if (campo.tipo === 'multiplas') {
      const lista = (Array.isArray(bruto) ? bruto : bruto ? [bruto] : []).map((v) => String(v).trim()).filter(Boolean)
      valor = lista.filter((v) => campo.opcoes?.includes(v))
      if (campo.obrigatorio && valor.length === 0) erros[campo.chave] = 'Escolha pelo menos uma opção.'
    } else {
      valor = String(Array.isArray(bruto) ? bruto[0] ?? '' : bruto ?? '').trim().slice(0, 5000)
      if (!valor) {
        if (campo.obrigatorio) erros[campo.chave] = 'Campo obrigatório.'
      } else if (campo.tipo === 'email' && !EMAIL_PATTERN.test(valor)) {
        erros[campo.chave] = 'Esse e-mail não parece válido.'
      } else if (campo.tipo === 'telefone' && valor.replace(/\D/g, '').length < 10) {
        erros[campo.chave] = 'Confere o número com DDD.'
      } else if ((campo.tipo === 'opcoes' || campo.tipo === 'select') && !campo.opcoes?.includes(valor)) {
        erros[campo.chave] = 'Opção inválida.'
      }
    }

    const vazio = Array.isArray(valor) ? valor.length === 0 : !valor
    if (!vazio) respostas.push({ chave: campo.chave, rotulo: campo.rotulo, valor })
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros }

  const texto = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : null)
  const porTipo = (tipo: CampoTipo) => texto(respostas.find((r) => campos.find((c) => c.chave === r.chave)?.tipo === tipo)?.valor)
  const ehEmpresa = (r: Resposta) => r.chave === 'empresa' || /\bempresa\b/i.test(r.rotulo)

  return {
    ok: true,
    respostas,
    lead: {
      nome: texto(respostas.find((r) => r.chave === CHAVE_NOME)?.valor) ?? 'Sem nome',
      email: porTipo('email'),
      telefone: porTipo('telefone'),
      empresa: texto(respostas.find(ehEmpresa)?.valor),
    },
  }
}

export function formatarValor(valor: string | string[]): string {
  return Array.isArray(valor) ? valor.join(', ') : valor
}

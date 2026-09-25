export const segmentoOpcoes = [
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'moda', label: 'Moda' },
  { value: 'tech', label: 'Tech' },
  { value: 'saude', label: 'Saúde' },
  { value: 'educacao', label: 'Educação' },
  { value: 'varejo', label: 'Varejo' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'industria', label: 'Indústria' },
  { value: 'outro', label: 'Outro' },
]

export const origemOpcoes = [
  { value: 'catalogo_place', label: 'Catálogo Place' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'google', label: 'Google' },
  { value: 'site', label: 'Site' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'evento', label: 'Evento' },
  { value: 'outro', label: 'Outro' },
]

const porValor = (opcoes: { value: string; label: string }[]) => Object.fromEntries(opcoes.map((o) => [o.value, o.label]))
const segmentoMap = porValor(segmentoOpcoes)
const origemMap = porValor(origemOpcoes)

export const labelSegmento = (v: string | null | undefined) => (v ? segmentoMap[v] ?? v : '—')
export const labelOrigem = (v: string | null | undefined) => (v ? origemMap[v] ?? v : '—')

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
  { value: 'clubelly', label: 'Clubelly' },
  { value: 'trafego_pago', label: 'Tráfego pago' },
  { value: 'trafego_pago_whatsapp', label: 'Tráfego pago · WhatsApp' },
  { value: 'landing-planejadores', label: 'Landing · Planejadores' },
  { value: 'landing-site', label: 'Landing · Criação de site' },
  { value: 'captacao_ativa', label: 'Captação ativa' },
  { value: 'representante_comercial', label: 'Prospecção por representante comercial' },
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

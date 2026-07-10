import { z } from 'zod'

export function parseValorBr(v: string | undefined): number {
  if (!v) return NaN
  return parseFloat(v.replace(',', '.'))
}

export const indicacaoSchema = z.object({
  indicador_id: z.string().uuid('Selecione o indicador.'),
  cliente_indicado_id: z.string().uuid('Selecione o cliente indicado.'),
  tipo_comissao: z.enum(['fixo', 'percentual']),
  valor_fixo: z.string().optional(),
  percentual: z.string().optional(),
  status: z.enum(['ativa', 'pausada', 'encerrada']),
  data_inicio: z.string().min(1, 'Data de início obrigatória'),
  data_fim: z.string().optional(),
  observacoes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.tipo_comissao === 'fixo') {
    const n = parseValorBr(data.valor_fixo)
    if (isNaN(n) || n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Informe um valor fixo válido.', path: ['valor_fixo'] })
    }
  }
  if (data.tipo_comissao === 'percentual') {
    const n = parseValorBr(data.percentual)
    if (isNaN(n) || n <= 0 || n > 100) {
      ctx.addIssue({ code: 'custom', message: 'Informe um percentual válido (entre 0 e 100).', path: ['percentual'] })
    }
  }
})

export type IndicacaoFormData = z.infer<typeof indicacaoSchema>

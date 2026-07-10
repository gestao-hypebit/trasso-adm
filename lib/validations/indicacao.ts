import { z } from 'zod'

export const indicacaoSchema = z.object({
  indicador_id: z.string().uuid('Selecione o indicador.'),
  cliente_indicado_id: z.string().uuid('Selecione o cliente indicado.'),
  tipo_comissao: z.enum(['fixo', 'percentual']),
  valor_fixo: z.number().positive('Valor deve ser positivo').optional(),
  percentual: z.number().positive('Percentual deve ser positivo').max(100, 'Máximo 100%').optional(),
  status: z.enum(['ativa', 'pausada', 'encerrada']),
  data_inicio: z.string().min(1, 'Data de início obrigatória'),
  data_fim: z.string().optional(),
  observacoes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.tipo_comissao === 'fixo' && !data.valor_fixo) {
    ctx.addIssue({ code: 'custom', message: 'Informe o valor fixo.', path: ['valor_fixo'] })
  }
  if (data.tipo_comissao === 'percentual' && !data.percentual) {
    ctx.addIssue({ code: 'custom', message: 'Informe o percentual.', path: ['percentual'] })
  }
})

export type IndicacaoFormData = z.infer<typeof indicacaoSchema>

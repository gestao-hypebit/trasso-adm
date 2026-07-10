import { z } from 'zod'

export const indicadorSchema = z.object({
  tipo: z.enum(['cliente', 'externo']),
  cliente_id: z.string().uuid().optional(),
  nome: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  chave_pix: z.string().optional(),
  observacoes: z.string().optional(),
  ativo: z.boolean(),
}).refine(
  (data) => (data.tipo === 'cliente' ? !!data.cliente_id : !data.cliente_id),
  { message: 'Selecione o cliente indicador.', path: ['cliente_id'] }
)

export type IndicadorFormData = z.infer<typeof indicadorSchema>

import { z } from 'zod'

export const lancamentoSchema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  descricao: z.string().min(2, 'Descrição obrigatória'),
  valor: z.number().positive('Valor deve ser positivo'),
  data: z.string(),
  data_competencia: z.string().optional(),
  status: z.enum(['pendente', 'pago', 'recebido', 'cancelado']).default('pendente'),
  categoria_id: z.string().uuid().optional(),
  cliente_id: z.string().uuid().optional(),
  projeto_id: z.string().uuid().optional(),
  forma_pagamento: z.enum(['pix', 'transferencia', 'boleto', 'cartao_credito', 'cartao_debito', 'dinheiro', 'outro']).optional(),
  recorrente: z.boolean().default(false),
  frequencia: z.enum(['mensal', 'bimestral', 'trimestral', 'semestral', 'anual']).optional(),
  observacoes: z.string().optional(),
})

export type LancamentoFormData = z.infer<typeof lancamentoSchema>

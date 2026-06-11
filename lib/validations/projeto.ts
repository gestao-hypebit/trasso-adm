import { z } from 'zod'

export const projetoSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  descricao: z.string().optional(),
  cliente_id: z.string().uuid().optional(),
  tipo: z.enum(['identidade_visual', 'site', 'software', 'marketing', 'social_media', 'outro']).optional(),
  status: z.enum(['backlog', 'em_andamento', 'aguardando_cliente', 'em_revisao', 'concluido', 'cancelado']).default('backlog'),
  prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']).default('media'),
  valor: z.number().positive().optional(),
  data_inicio: z.string().optional(),
  data_entrega: z.string().optional(),
  progresso: z.number().min(0).max(100).default(0),
  tags: z.array(z.string()).optional(),
})

export type ProjetoFormData = z.infer<typeof projetoSchema>

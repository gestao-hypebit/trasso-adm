import { z } from 'zod'

export const clienteSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  empresa: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  segmento: z.string().optional(),
  origem: z.string().optional(),
  status: z.enum(['ativo', 'inativo', 'lead', 'prospecto']).default('ativo'),
  tags: z.array(z.string()).optional(),
  observacoes: z.string().optional(),
})

export type ClienteFormData = z.infer<typeof clienteSchema>

// O que fazer com o lead em cada etapa do funil (card e painel do lead).

import type { LeadStatus } from '@/lib/leads/formulario'

export const PROXIMO_PASSO: Partial<Record<LeadStatus, string>> = {
  novo: 'Fazer o primeiro contato',
  em_contato: 'Marcar a reunião',
  qualificado: 'Enviar a proposta',
  proposta: 'Fechar a venda',
  convertido: 'Começar o projeto',
}

export const proximoPasso = (status: string) => PROXIMO_PASSO[status as LeadStatus] ?? null

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0]

// Mensagens prontas do WhatsApp para cada momento.
export const mensagemWhatsapp = {
  primeiroContato: (nome: string, marca: string) =>
    `Oi ${primeiroNome(nome)}! Aqui é da ${marca}, recebemos seu contato. Podemos conversar?`,
  confirmarReuniao: (nome: string, quando: string, meet: string | null) =>
    `Oi ${primeiroNome(nome)}! Confirmando nossa reunião ${quando}.${meet ? ` Link: ${meet}` : ''}`,
  cobrarProposta: (nome: string) =>
    `Oi ${primeiroNome(nome)}! Conseguiu dar uma olhada na proposta? Fico à disposição para ajustar o que precisar.`,
}

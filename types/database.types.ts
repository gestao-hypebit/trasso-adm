export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; nome: string; email: string; cargo: string | null; avatar_url: string | null; created_at: string }
        Insert: { id: string; nome: string; email: string; cargo?: string | null; avatar_url?: string | null; created_at?: string }
        Update: { id?: string; nome?: string; email?: string; cargo?: string | null; avatar_url?: string | null; created_at?: string }
      }
      clientes: {
        Row: { id: string; nome: string; empresa: string | null; email: string | null; telefone: string | null; whatsapp: string | null; cpf_cnpj: string | null; endereco: string | null; cidade: string | null; estado: string | null; cep: string | null; segmento: string | null; origem: string | null; status: string; tipo: string; produto_id: string | null; tags: string[] | null; observacoes: string | null; responsavel_id: string | null; portal_token: string; portal_ativo: boolean; portal_token_created_at: string; portal_last_accessed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; nome: string; empresa?: string | null; email?: string | null; telefone?: string | null; whatsapp?: string | null; cpf_cnpj?: string | null; endereco?: string | null; cidade?: string | null; estado?: string | null; cep?: string | null; segmento?: string | null; origem?: string | null; status?: string; tipo?: string; produto_id?: string | null; tags?: string[] | null; observacoes?: string | null; responsavel_id?: string | null; portal_token?: string; portal_ativo?: boolean; portal_token_created_at?: string; portal_last_accessed_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; nome?: string; empresa?: string | null; email?: string | null; telefone?: string | null; whatsapp?: string | null; cpf_cnpj?: string | null; endereco?: string | null; cidade?: string | null; estado?: string | null; cep?: string | null; segmento?: string | null; origem?: string | null; status?: string; tipo?: string; produto_id?: string | null; tags?: string[] | null; observacoes?: string | null; responsavel_id?: string | null; portal_token?: string; portal_ativo?: boolean; portal_token_created_at?: string; portal_last_accessed_at?: string | null; created_at?: string; updated_at?: string }
      }
      interacoes: {
        Row: { id: string; cliente_id: string; tipo: string; titulo: string; descricao: string | null; data: string; proximo_contato: string | null; responsavel_id: string | null; created_at: string }
        Insert: { id?: string; cliente_id: string; tipo: string; titulo: string; descricao?: string | null; data?: string; proximo_contato?: string | null; responsavel_id?: string | null; created_at?: string }
        Update: { id?: string; cliente_id?: string; tipo?: string; titulo?: string; descricao?: string | null; data?: string; proximo_contato?: string | null; responsavel_id?: string | null; created_at?: string }
      }
      servicos: {
        Row: { id: string; nome: string; descricao: string | null; categoria: string | null; preco_base: number | null; unidade: string; ativo: boolean; created_at: string }
        Insert: { id?: string; nome: string; descricao?: string | null; categoria?: string | null; preco_base?: number | null; unidade?: string; ativo?: boolean; created_at?: string }
        Update: { id?: string; nome?: string; descricao?: string | null; categoria?: string | null; preco_base?: number | null; unidade?: string; ativo?: boolean; created_at?: string }
      }
      propostas: {
        Row: { id: string; numero: string; cliente_id: string | null; titulo: string; descricao: string | null; status: string; validade: string | null; valor_total: number; desconto_percentual: number; valor_final: number; condicoes_pagamento: string | null; observacoes: string | null; responsavel_id: string | null; enviada_em: string | null; aprovada_em: string | null; aprovada_ip: string | null; aprovada_user_agent: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; numero: string; cliente_id?: string | null; titulo: string; descricao?: string | null; status?: string; validade?: string | null; valor_total: number; desconto_percentual?: number; condicoes_pagamento?: string | null; observacoes?: string | null; responsavel_id?: string | null; enviada_em?: string | null; aprovada_em?: string | null; aprovada_ip?: string | null; aprovada_user_agent?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; numero?: string; cliente_id?: string | null; titulo?: string; descricao?: string | null; status?: string; validade?: string | null; valor_total?: number; desconto_percentual?: number; condicoes_pagamento?: string | null; observacoes?: string | null; responsavel_id?: string | null; enviada_em?: string | null; aprovada_em?: string | null; aprovada_ip?: string | null; aprovada_user_agent?: string | null; created_at?: string; updated_at?: string }
      }
      proposta_itens: {
        Row: { id: string; proposta_id: string; servico_id: string | null; descricao: string; quantidade: number; valor_unitario: number; valor_total: number; ordem: number }
        Insert: { id?: string; proposta_id: string; servico_id?: string | null; descricao: string; quantidade?: number; valor_unitario: number; ordem?: number }
        Update: { id?: string; proposta_id?: string; servico_id?: string | null; descricao?: string; quantidade?: number; valor_unitario?: number; ordem?: number }
      }
      contratos: {
        Row: { id: string; numero: string; proposta_id: string | null; cliente_id: string | null; titulo: string; tipo: string | null; status: string; valor_total: number; data_inicio: string | null; data_fim: string | null; condicoes_pagamento: string | null; clausulas: string | null; arquivo_url: string | null; assinado_em: string | null; assinado_ip: string | null; assinado_user_agent: string | null; assinado_nome: string | null; responsavel_id: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; numero: string; proposta_id?: string | null; cliente_id?: string | null; titulo: string; tipo?: string | null; status?: string; valor_total: number; data_inicio?: string | null; data_fim?: string | null; condicoes_pagamento?: string | null; clausulas?: string | null; arquivo_url?: string | null; assinado_em?: string | null; assinado_ip?: string | null; assinado_user_agent?: string | null; assinado_nome?: string | null; responsavel_id?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; numero?: string; proposta_id?: string | null; cliente_id?: string | null; titulo?: string; tipo?: string | null; status?: string; valor_total?: number; data_inicio?: string | null; data_fim?: string | null; condicoes_pagamento?: string | null; clausulas?: string | null; arquivo_url?: string | null; assinado_em?: string | null; assinado_ip?: string | null; assinado_user_agent?: string | null; assinado_nome?: string | null; responsavel_id?: string | null; created_at?: string; updated_at?: string }
      }
      projetos: {
        Row: { id: string; nome: string; descricao: string | null; cliente_id: string | null; contrato_id: string | null; tipo: string | null; status: string; prioridade: string; valor: number | null; data_inicio: string | null; data_entrega: string | null; data_conclusao: string | null; progresso: number; responsavel_id: string | null; tags: string[] | null; created_at: string; updated_at: string }
        Insert: { id?: string; nome: string; descricao?: string | null; cliente_id?: string | null; contrato_id?: string | null; tipo?: string | null; status?: string; prioridade?: string; valor?: number | null; data_inicio?: string | null; data_entrega?: string | null; data_conclusao?: string | null; progresso?: number; responsavel_id?: string | null; tags?: string[] | null; created_at?: string; updated_at?: string }
        Update: { id?: string; nome?: string; descricao?: string | null; cliente_id?: string | null; contrato_id?: string | null; tipo?: string | null; status?: string; prioridade?: string; valor?: number | null; data_inicio?: string | null; data_entrega?: string | null; data_conclusao?: string | null; progresso?: number; responsavel_id?: string | null; tags?: string[] | null; created_at?: string; updated_at?: string }
      }
      tarefas: {
        Row: { id: string; projeto_id: string | null; titulo: string; descricao: string | null; status: string; prioridade: string; responsavel_id: string | null; data_vencimento: string | null; concluida_em: string | null; ordem: number; created_at: string; updated_at: string }
        Insert: { id?: string; projeto_id?: string | null; titulo: string; descricao?: string | null; status?: string; prioridade?: string; responsavel_id?: string | null; data_vencimento?: string | null; concluida_em?: string | null; ordem?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; projeto_id?: string | null; titulo?: string; descricao?: string | null; status?: string; prioridade?: string; responsavel_id?: string | null; data_vencimento?: string | null; concluida_em?: string | null; ordem?: number; created_at?: string; updated_at?: string }
      }
      categorias_financeiras: {
        Row: { id: string; nome: string; tipo: string; cor: string; icone: string | null; created_at: string }
        Insert: { id?: string; nome: string; tipo: string; cor?: string; icone?: string | null; created_at?: string }
        Update: { id?: string; nome?: string; tipo?: string; cor?: string; icone?: string | null; created_at?: string }
      }
      lancamentos: {
        Row: { id: string; tipo: string; descricao: string; valor: number; data: string; data_competencia: string | null; status: string; categoria_id: string | null; cliente_id: string | null; projeto_id: string | null; produto_id: string | null; forma_pagamento: string | null; recorrente: boolean; frequencia: string | null; comprovante_url: string | null; observacoes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; tipo: string; descricao: string; valor: number; data: string; data_competencia?: string | null; status?: string; categoria_id?: string | null; cliente_id?: string | null; projeto_id?: string | null; produto_id?: string | null; forma_pagamento?: string | null; recorrente?: boolean; frequencia?: string | null; comprovante_url?: string | null; observacoes?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; tipo?: string; descricao?: string; valor?: number; data?: string; data_competencia?: string | null; status?: string; categoria_id?: string | null; cliente_id?: string | null; projeto_id?: string | null; produto_id?: string | null; forma_pagamento?: string | null; recorrente?: boolean; frequencia?: string | null; comprovante_url?: string | null; observacoes?: string | null; created_at?: string; updated_at?: string }
      }
      configuracoes_agencia: {
        Row: { id: string; nome: string; cnpj: string | null; email: string | null; telefone: string | null; site: string | null; cidade: string | null; endereco: string | null; logo_url: string | null; proposta_prefixo: string; proposta_contador: number; contrato_prefixo: string; contrato_contador: number; created_at: string; updated_at: string }
        Insert: { id?: string; nome?: string; cnpj?: string | null; email?: string | null; telefone?: string | null; site?: string | null; cidade?: string | null; endereco?: string | null; logo_url?: string | null; proposta_prefixo?: string; proposta_contador?: number; contrato_prefixo?: string; contrato_contador?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; nome?: string; cnpj?: string | null; email?: string | null; telefone?: string | null; site?: string | null; cidade?: string | null; endereco?: string | null; logo_url?: string | null; proposta_prefixo?: string; proposta_contador?: number; contrato_prefixo?: string; contrato_contador?: number; created_at?: string; updated_at?: string }
      }
      produtos: {
        Row: { id: string; nome: string; tipo: string; descricao: string | null; cor: string; url: string | null; logo_url: string | null; ativo: boolean; stripe_secret_key: string | null; stripe_webhook_secret: string | null; last_synced_at: string | null; created_at: string }
        Insert: { id?: string; nome: string; tipo: string; descricao?: string | null; cor?: string; url?: string | null; logo_url?: string | null; ativo?: boolean; stripe_secret_key?: string | null; stripe_webhook_secret?: string | null; last_synced_at?: string | null; created_at?: string }
        Update: { id?: string; nome?: string; tipo?: string; descricao?: string | null; cor?: string; url?: string | null; logo_url?: string | null; ativo?: boolean; stripe_secret_key?: string | null; stripe_webhook_secret?: string | null; last_synced_at?: string | null; created_at?: string }
      }
      saas_clientes: {
        Row: { id: string; produto_id: string; nome: string; email: string | null; telefone: string | null; plano: string | null; mrr: number; status: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; data_inicio: string | null; data_cancelamento: string | null; ultimo_pagamento: string | null; proximo_vencimento: string | null; observacoes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; produto_id: string; nome: string; email?: string | null; telefone?: string | null; plano?: string | null; mrr?: number; status?: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; data_inicio?: string | null; data_cancelamento?: string | null; ultimo_pagamento?: string | null; proximo_vencimento?: string | null; observacoes?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; produto_id?: string; nome?: string; email?: string | null; telefone?: string | null; plano?: string | null; mrr?: number; status?: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; data_inicio?: string | null; data_cancelamento?: string | null; ultimo_pagamento?: string | null; proximo_vencimento?: string | null; observacoes?: string | null; created_at?: string; updated_at?: string }
      }
      eventos: {
        Row: { id: string; titulo: string; descricao: string | null; tipo: string | null; data_inicio: string; data_fim: string | null; dia_inteiro: boolean; cliente_id: string | null; projeto_id: string | null; responsavel_id: string | null; link_meet: string | null; created_at: string }
        Insert: { id?: string; titulo: string; descricao?: string | null; tipo?: string | null; data_inicio: string; data_fim?: string | null; dia_inteiro?: boolean; cliente_id?: string | null; projeto_id?: string | null; responsavel_id?: string | null; link_meet?: string | null; created_at?: string }
        Update: { id?: string; titulo?: string; descricao?: string | null; tipo?: string | null; data_inicio?: string; data_fim?: string | null; dia_inteiro?: boolean; cliente_id?: string | null; projeto_id?: string | null; responsavel_id?: string | null; link_meet?: string | null; created_at?: string }
      }
      notificacoes: {
        Row: { id: string; usuario_id: string | null; titulo: string; mensagem: string | null; tipo: string | null; lida: boolean; link: string | null; created_at: string }
        Insert: { id?: string; usuario_id?: string | null; titulo: string; mensagem?: string | null; tipo?: string | null; lida?: boolean; link?: string | null; created_at?: string }
        Update: { id?: string; usuario_id?: string | null; titulo?: string; mensagem?: string | null; tipo?: string | null; lida?: boolean; link?: string | null; created_at?: string }
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
  }
}

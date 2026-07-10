-- Comissão por indicação: indicadores, indicações e comissões geradas mensalmente.
--
-- Este projeto não usa a Supabase CLI / migration runner (esta é a primeira
-- migration versionada do repositório). Cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente.
--
-- Depois de rodar, replique nas 3 tabelas abaixo as mesmas RLS policies já
-- aplicadas em `clientes` e `lancamentos` (não estão versionadas no repo).

create table if not exists indicadores (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('cliente', 'externo')),
  cliente_id uuid references clientes(id),
  nome text not null,
  email text,
  telefone text,
  whatsapp text,
  chave_pix text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint indicador_cliente_coerente check (
    (tipo = 'cliente' and cliente_id is not null) or
    (tipo = 'externo' and cliente_id is null)
  )
);

create index if not exists indicadores_cliente_id_idx on indicadores (cliente_id);

create table if not exists indicacoes (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references indicadores(id),
  cliente_indicado_id uuid not null references clientes(id),
  tipo_comissao text not null check (tipo_comissao in ('fixo', 'percentual')),
  valor_fixo numeric(10, 2),
  percentual numeric(5, 2),
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'encerrada')),
  data_inicio date not null default current_date,
  data_fim date,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint indicacao_valor_coerente check (
    (tipo_comissao = 'fixo' and valor_fixo is not null and percentual is null) or
    (tipo_comissao = 'percentual' and percentual is not null and valor_fixo is null)
  )
);

create index if not exists indicacoes_indicador_id_idx on indicacoes (indicador_id);
create index if not exists indicacoes_cliente_indicado_id_idx on indicacoes (cliente_indicado_id);

-- No máximo 1 indicação ativa por cliente indicado (sem comissão dividida).
create unique index if not exists indicacoes_cliente_ativa_unica
  on indicacoes (cliente_indicado_id) where (status = 'ativa');

create table if not exists comissoes (
  id uuid primary key default gen_random_uuid(),
  indicacao_id uuid not null references indicacoes(id),
  indicador_id uuid not null references indicadores(id),
  competencia date not null,
  valor numeric(10, 2) not null,
  lancamento_id uuid not null references lancamentos(id),
  observacoes text,
  created_at timestamptz not null default now(),
  unique (indicacao_id, competencia)
);

create index if not exists comissoes_competencia_idx on comissoes (competencia);
create index if not exists comissoes_indicador_id_idx on comissoes (indicador_id);

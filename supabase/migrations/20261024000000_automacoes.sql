-- Automações do dia a dia:
--
--   asaas_assinaturas_registro  → o que o sistema já sabe de cada assinatura do Asaas
--                                 (já virou "cliente novo" nas Metas? já avisou o
--                                 cancelamento?). Na primeira execução, tudo o que já
--                                 existe vira ponto de partida: nada antigo é lançado.
--   cobranca_avisos             → régua de cobrança: quais avisos de atraso (3, 7 e
--                                 15 dias) já foram dados para cada lançamento vencido.
--   metas_movimentacoes.origem  → 'manual' (digitada) ou 'asaas' (registrada sozinha).
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

create table if not exists asaas_assinaturas_registro (
  subscription_id text primary key,
  customer_id text not null,
  linha text,
  nome text,
  valor numeric(12, 2),
  primeiro_pagamento date,
  novo_registrado boolean not null default false,
  cancelamento_registrado boolean not null default false,
  cancelado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cobranca_avisos (
  lancamento_id uuid not null references lancamentos (id) on delete cascade,
  etapa integer not null check (etapa in (3, 7, 15)),
  created_at timestamptz not null default now(),
  primary key (lancamento_id, etapa)
);

alter table metas_movimentacoes add column if not exists origem text not null default 'manual'
  check (origem in ('manual', 'asaas'));
alter table metas_movimentacoes add column if not exists asaas_subscription_id text;

do $$
declare
  t text;
begin
  foreach t in array array['asaas_assinaturas_registro', 'cobranca_avisos'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'authenticated_all') then
      execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

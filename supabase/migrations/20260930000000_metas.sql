-- Metas mensais de aquisição (substitui a planilha Metas_Trasso_*.xlsx).
--
-- metas_mensais        → quantos clientes novos quero fechar no mês, por frente
-- metas_movimentacoes  → registro de TODA movimentação: cliente novo ou cancelamento
--
-- O realizado, % atingido, ritmo e churn são calculados na tela /metas a
-- partir das movimentações — nada é digitado duas vezes.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

-- ------------------------------------------------------------------
-- Metas por mês e frente
-- ------------------------------------------------------------------
create table if not exists metas_mensais (
  id uuid primary key default gen_random_uuid(),
  -- Sempre o primeiro dia do mês (ex: 2026-09-01).
  competencia date not null,
  frente text not null check (frente in ('catalogo_place', 'trasso')),
  meta_novos integer not null default 0 check (meta_novos >= 0),
  -- Realizado do mês anterior informado à mão. Só é usado quando o mês
  -- anterior não tem movimentações registradas no sistema (ex: meses
  -- que ficaram na planilha). Nulo = calcular pelas movimentações.
  base_anterior integer check (base_anterior >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competencia, frente)
);

alter table metas_mensais enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'metas_mensais' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on metas_mensais
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ------------------------------------------------------------------
-- Movimentações (clientes novos e cancelamentos)
-- ------------------------------------------------------------------
create table if not exists metas_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  cliente_nome text not null,
  frente text not null check (frente in ('catalogo_place', 'trasso')),
  tipo text not null check (tipo in ('novo', 'cancelamento')),
  -- Canal de aquisição. Nulo em cancelamentos.
  canal text check (canal in ('captacao_ativa', 'trafego_pago', 'indicacao', 'inbound', 'outro')),
  -- Mensalidade (Catálogo Place) ou valor do serviço (Trasso).
  valor numeric(12, 2) not null default 0,
  motivo text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists metas_movimentacoes_data_idx on metas_movimentacoes (data desc);

alter table metas_movimentacoes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'metas_movimentacoes' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on metas_movimentacoes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ------------------------------------------------------------------
-- Metas de setembro/2026 vindas da planilha (agosto real: 17 e 2)
-- ------------------------------------------------------------------
insert into metas_mensais (competencia, frente, meta_novos, base_anterior)
values
  ('2026-09-01', 'catalogo_place', 30, 17),
  ('2026-09-01', 'trasso', 4, 2)
on conflict (competencia, frente) do nothing;

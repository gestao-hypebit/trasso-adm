-- Metas diárias: rotinas que se repetem todo dia (ex: mandar mensagem para
-- 40 pessoas oferecendo o Catálogo Place) e o quanto foi feito em cada dia.
--
-- metas_diarias           → a rotina: nome, alvo por dia e em que dias da semana vale
-- metas_diarias_registros → quanto foi feito em cada dia (uma linha por meta e dia)
--
-- Sequência de dias, % e histórico são calculados na tela /metas-diarias.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

create table if not exists metas_diarias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  -- Quantas vezes por dia (ex: 40 mensagens).
  alvo integer not null default 1 check (alvo > 0),
  -- Como chamar cada unidade (ex: "mensagens", "ligações").
  unidade text not null default 'vezes',
  -- Dias da semana em que a meta vale: 0 = domingo ... 6 = sábado.
  dias_semana smallint[] not null default '{1,2,3,4,5}',
  cor text not null default '#8B5CF6',
  ordem integer not null default 0,
  -- Arquivada some da tela do dia mas mantém o histórico.
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table metas_diarias enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'metas_diarias' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on metas_diarias
      for all to authenticated using (true) with check (true);
  end if;
end $$;

create table if not exists metas_diarias_registros (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references metas_diarias(id) on delete cascade,
  data date not null,
  quantidade integer not null default 0 check (quantidade >= 0),
  updated_at timestamptz not null default now(),
  unique (meta_id, data)
);

create index if not exists metas_diarias_registros_data_idx on metas_diarias_registros (data desc);

alter table metas_diarias_registros enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'metas_diarias_registros' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on metas_diarias_registros
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Primeira meta: prospecção ativa do Catálogo Place.
insert into metas_diarias (titulo, alvo, unidade, dias_semana, cor, ordem)
select 'Oferecer o Catálogo Place', 40, 'mensagens', '{1,2,3,4,5}', '#8B5CF6', 0
where not exists (select 1 from metas_diarias);

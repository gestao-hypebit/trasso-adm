-- Rentabilidade por projeto (apontamento de horas + custo/hora), upload de
-- contratos assinados e notificações vindas do portal do cliente.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

-- ------------------------------------------------------------------
-- Custo/hora da agência e horas estimadas por projeto
-- ------------------------------------------------------------------
alter table configuracoes_agencia
  add column if not exists custo_hora numeric(10,2) not null default 0;

alter table projetos
  add column if not exists horas_estimadas numeric(8,2);

-- ------------------------------------------------------------------
-- Apontamento de horas por projeto
-- ------------------------------------------------------------------
create table if not exists apontamentos_horas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  usuario_id uuid references profiles(id),
  data date not null default current_date,
  horas numeric(6,2) not null check (horas > 0),
  descricao text,
  created_at timestamptz not null default now()
);

create index if not exists apontamentos_horas_projeto_id_idx on apontamentos_horas (projeto_id);

alter table apontamentos_horas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'apontamentos_horas' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on apontamentos_horas
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ------------------------------------------------------------------
-- Bucket privado para PDFs de contratos assinados
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('contratos', 'contratos', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'contratos_authenticated_all') then
    create policy "contratos_authenticated_all" on storage.objects
      for all to authenticated
      using (bucket_id = 'contratos')
      with check (bucket_id = 'contratos');
  end if;
end $$;

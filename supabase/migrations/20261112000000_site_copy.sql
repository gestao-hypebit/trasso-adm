-- Aprovação da copy do site, seção por seção, antes do desenvolvimento.
--
-- A equipe monta as seções em Sites → (site) → Copy e envia para aprovação.
-- O cliente vê no portal (/portal/<token>, aba "Copy do site"), aprova ou
-- pede ajuste em cada seção. Cada envio é uma rodada; aprovado fica travado
-- até a equipe reabrir.
--
--   site_copy_secoes   seções da copy: título, observação para o cliente e os
--                      textos ([{ _id, rotulo, texto }]); status e rodada
--   site_copy_eventos  histórico: enviada, aprovada, ajustes, reaberta
--   sites_clientes     ganha copy_rodada e copy_enviada_em
--
-- status: rascunho (só a equipe vê) → aguardando (cliente vê e responde)
--         → aprovada | ajustes (volta para a equipe, que reenvia)
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

alter table sites_clientes add column if not exists copy_rodada int not null default 0;
alter table sites_clientes add column if not exists copy_enviada_em timestamptz;

create table if not exists site_copy_secoes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites_clientes(id) on delete cascade,
  ordem int not null default 0,
  titulo text not null default 'Nova seção',
  observacao text,
  campos jsonb not null default '[]'::jsonb,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'aguardando', 'ajustes', 'aprovada')),
  rodada int not null default 0,
  comentario_cliente text,
  respondido_em timestamptz,
  respondido_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_copy_secoes_site_idx on site_copy_secoes (site_id, ordem);

create table if not exists site_copy_eventos (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites_clientes(id) on delete cascade,
  secao_id uuid references site_copy_secoes(id) on delete cascade,
  rodada int not null default 0,
  tipo text not null check (tipo in ('enviada', 'aprovada', 'ajustes', 'reaberta')),
  comentario text,
  autor text,
  created_at timestamptz not null default now()
);

create index if not exists site_copy_eventos_site_idx on site_copy_eventos (site_id, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['site_copy_secoes', 'site_copy_eventos'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'authenticated_all') then
      execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

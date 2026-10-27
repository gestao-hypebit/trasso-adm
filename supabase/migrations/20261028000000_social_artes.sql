-- Gerador de artes do social media.
--
--   social_posts.tipo   tipo de conteúdo do post (venda, autoridade, conexão…)
--   social_posts.artes  lâminas da arte: [{ template, dados }], na ordem do carrossel.
--                       As PNGs geradas a partir delas vão para social_posts.midias.
--   social_temas        tema visual de cada cliente (cores, fonte, logo, rodapé),
--                       reaproveitado em todos os planejamentos dela.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

alter table social_posts add column if not exists tipo text;
alter table social_posts add column if not exists artes jsonb not null default '[]'::jsonb;

create table if not exists social_temas (
  cliente_id uuid primary key references clientes(id) on delete cascade,
  tema jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table social_temas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'social_temas' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on social_temas for all to authenticated using (true) with check (true);
  end if;
end $$;

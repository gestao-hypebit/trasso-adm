-- Gerador de prévias de site (captação de clientes).
--
-- Você preenche o briefing, a IA escreve os textos (que você revisa) e depois
-- gera o site em um único HTML com Tailwind. A prévia fica num link público
-- (/p/<slug>) para mandar ao cliente; cada ajuste vira uma versão nova.
--
--   site_previas         uma prévia por empresa/proposta
--   site_previa_versoes  histórico do HTML (dá para voltar a qualquer versão)
--   bucket "sites"       logo e fotos enviados no briefing (público, para o
--                        HTML da prévia conseguir carregar as imagens)
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

create table if not exists site_previas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,                       -- nome da empresa (aparece na lista)
  slug text not null unique,                -- endereço público: /p/<slug>
  cliente_id uuid references clientes(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  briefing jsonb not null default '{}'::jsonb,
  conteudo jsonb,                           -- textos aprovados (estrutura + copy)
  status text not null default 'rascunho'
    check (status in ('rascunho', 'conteudo', 'gerando', 'pronto', 'erro')),
  erro text,
  html text,                                -- versão atual do site
  versao_atual int not null default 0,
  publicada boolean not null default true,  -- desligar tira o link do ar
  visualizacoes int not null default 0,
  ultima_visualizacao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_previas_created_idx on site_previas (created_at desc);

create table if not exists site_previa_versoes (
  id uuid primary key default gen_random_uuid(),
  previa_id uuid not null references site_previas(id) on delete cascade,
  numero int not null,
  html text not null,
  instrucao text,                           -- o que foi pedido (nulo = geração inicial)
  created_at timestamptz not null default now(),
  unique (previa_id, numero)
);

do $$
declare
  t text;
begin
  foreach t in array array['site_previas', 'site_previa_versoes'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'authenticated_all') then
      execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- Conta uma visualização do link público (chamada pelo servidor, sem login).
create or replace function site_previa_visualizar(p_slug text) returns void
language sql security definer set search_path = public as $$
  update site_previas
    set visualizacoes = visualizacoes + 1, ultima_visualizacao = now()
    where slug = p_slug;
$$;

-- Imagens do briefing (logo, fotos).
insert into storage.buckets (id, name, public)
values ('sites', 'sites', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'sites_authenticated_all') then
    create policy "sites_authenticated_all" on storage.objects
      for all to authenticated
      using (bucket_id = 'sites')
      with check (bucket_id = 'sites');
  end if;
end $$;

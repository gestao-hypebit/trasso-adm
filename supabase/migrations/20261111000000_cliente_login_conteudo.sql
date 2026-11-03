-- Área do cliente (/entrar → /meu-site) e editor de conteúdo dos sites.
--
-- LOGIN DO CLIENTE: não usa o Supabase Auth de propósito. As tabelas do
-- administrativo liberam tudo para qualquer usuário "authenticated"; se o
-- cliente fosse um usuário do Supabase Auth, ele leria o financeiro, os
-- contratos etc. O login é por código no e-mail e a sessão é um cookie
-- próprio, conferido no servidor (lib/cliente-auth). Por isso as tabelas de
-- código e sessão NÃO têm policy: só a service role lê e grava.
--
--   cliente_acessos        quem do cliente pode entrar (e-mail), criado pela equipe
--   cliente_codigos        códigos de 6 dígitos (só o hash), 10 min, 5 tentativas
--   cliente_sessoes        sessões abertas (só o hash do token do cookie)
--   site_conteudos         estrutura do site (enviada pelo próprio site), rascunho e publicado
--   site_conteudo_versoes  cada publicação, para voltar atrás
--   bucket sites-conteudo  imagens enviadas no editor (público, só imagem, até 5 MB)
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

create table if not exists cliente_acessos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  nome text,
  ativo boolean not null default true,
  ultimo_acesso timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cliente_acessos_cliente_idx on cliente_acessos (cliente_id);

create table if not exists cliente_codigos (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas int not null default 0,
  usado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists cliente_codigos_email_idx on cliente_codigos (email, created_at desc);

create table if not exists cliente_sessoes (
  id uuid primary key default gen_random_uuid(),
  acesso_id uuid not null references cliente_acessos(id) on delete cascade,
  token_hash text not null unique,
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists cliente_sessoes_acesso_idx on cliente_sessoes (acesso_id);

create table if not exists site_conteudos (
  site_id uuid primary key references sites_clientes(id) on delete cascade,
  estrutura jsonb,                     -- seções e campos editáveis (vem do site: /api/slick/schema)
  estrutura_atualizada_em timestamptz,
  rascunho jsonb not null default '{}'::jsonb,
  publicado jsonb,
  publicado_em timestamptz,
  publicado_por text,
  updated_at timestamptz not null default now()
);

create table if not exists site_conteudo_versoes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites_clientes(id) on delete cascade,
  conteudo jsonb not null,
  publicado_por text,
  created_at timestamptz not null default now()
);

create index if not exists site_conteudo_versoes_site_idx on site_conteudo_versoes (site_id, created_at desc);

-- RLS: todas ligadas. Equipe (authenticated) gerencia acessos, conteúdo e versões.
-- Códigos e sessões ficam sem policy (só service role).
do $$
declare
  t text;
begin
  foreach t in array array['cliente_acessos', 'cliente_codigos', 'cliente_sessoes', 'site_conteudos', 'site_conteudo_versoes'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
  foreach t in array array['cliente_acessos', 'site_conteudos', 'site_conteudo_versoes'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'authenticated_all') then
      execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- Imagens do editor. O upload é feito com URL assinada gerada no servidor
-- depois de conferir quem está editando; o bucket limita tipo e tamanho.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sites-conteudo', 'sites-conteudo', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

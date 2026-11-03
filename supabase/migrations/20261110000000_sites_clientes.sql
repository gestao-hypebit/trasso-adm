-- Sites dos clientes (os sites que a Slick faz e entrega) e os leads que
-- chegam pelos formulários deles.
--
-- Separado de `leads` de propósito: `leads` é o funil de vendas da própria
-- Slick (metas, conversão, sino de notificação). Lead do site do cliente é do
-- cliente e aparece para ele no portal, sem misturar com o nosso funil.
--
--   sites_clientes  um registro por site entregue, ligado ao cliente do CRM.
--                   Cada site tem a própria chave de API (só o hash fica aqui;
--                   a chave aparece uma única vez, na hora de gerar).
--   site_leads      contatos recebidos pelo site, via
--                   POST /api/publico/sites/leads (header x-site-key).
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

create table if not exists sites_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nome text not null,
  dominio text,
  repositorio text,
  chave_hash text unique,            -- sha256 (hex) da chave de API do site
  chave_prefixo text,                -- começo da chave, só para reconhecer na tela
  chave_criada_em timestamptz,
  ativo boolean not null default true,  -- desligado: a API recusa os leads
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sites_clientes_cliente_idx on sites_clientes (cliente_id);

create table if not exists site_leads (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites_clientes(id) on delete cascade,
  formulario text not null default 'contato',   -- qual formulário do site (contato, orcamento...)
  nome text not null,
  email text,
  telefone text,
  -- Demais campos do formulário: [{ chave, rotulo, valor }]
  respostas jsonb not null default '[]'::jsonb,
  status text not null default 'novo'
    check (status in ('novo', 'em_contato', 'convertido', 'descartado')),
  pagina text,
  utm jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_leads_site_idx on site_leads (site_id, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['sites_clientes', 'site_leads'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'authenticated_all') then
      execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

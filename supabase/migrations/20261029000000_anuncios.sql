-- Gestão de anúncios: gasto (Meta) e resultado real (eventos dos produtos)
-- separados por marca.
--
--   anuncio_marcas            → Catálogo Place, Slick, Clubelly… Cada marca tem
--                               prefixos de nome de campanha e a chave de API
--                               (só o hash) que os produtos usam para mandar eventos.
--   anuncio_contas            → contas de anúncio (hoje só Meta).
--   anuncio_campanhas         → status e orçamento atuais de cada campanha.
--   anuncio_campanha_marca    → campanha → marca. origem 'auto' (prefixo do nome,
--                               refeita a cada sincronização) ou 'manual' (nunca
--                               sobrescrita pela sincronização).
--   anuncio_metricas_diarias  → insights do Meta por dia e anúncio (upsert por data + ad_id).
--   anuncio_sincronizacoes    → log de cada sincronização.
--   funil_eventos             → cadastro / ativação / assinatura / cancelamento vindos
--                               dos produtos. Sem dados pessoais: só um id opaco do cliente.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

-- ------------------------------------------------------------------
-- Marcas
-- ------------------------------------------------------------------
create table if not exists anuncio_marcas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  -- Começos de nome de campanha que identificam a marca. O primeiro é o
  -- padrão novo ("CP | VENDAS | …"); os outros cobrem nomes antigos.
  prefixos text[] not null default '{}',
  cor text not null default '#7C3AED',
  -- Linha do financeiro (lib/financeiro/linhas.ts) que a marca representa.
  linha text check (linha in ('agencia', 'catalogo_place', 'clubelly')),
  ativo boolean not null default true,
  api_key_hash text unique,
  api_key_criada_em timestamptz,
  created_at timestamptz not null default now()
);

insert into anuncio_marcas (nome, slug, prefixos, cor, linha, ativo) values
  ('Catálogo Place', 'catalogo-place', '{CP,Catálogo Place,Catalogo Place,Catalogfy}', '#B8F000', 'catalogo_place', true),
  ('Slick', 'slick', '{SLICK,TRASSO}', '#7C3AED', 'agencia', true),
  ('Clubelly', 'clubelly', '{CLUBELLY}', '#38BDF8', 'clubelly', false)
on conflict (slug) do nothing;

-- ------------------------------------------------------------------
-- Contas de anúncio
-- ------------------------------------------------------------------
create table if not exists anuncio_contas (
  id uuid primary key default gen_random_uuid(),
  plataforma text not null default 'meta' check (plataforma in ('meta', 'google_ads')),
  account_id text not null,          -- Meta: "act_…"
  nome text not null,
  business_id text,
  moeda text not null default 'BRL',
  fuso text not null default 'America/Sao_Paulo',
  ativo boolean not null default true,
  -- Primeira carga (90 dias) é feita em blocos; aqui fica o próximo dia a buscar.
  backfill_proximo date,
  backfill_concluido_em timestamptz,
  ultima_sync_em timestamptz,
  created_at timestamptz not null default now(),
  unique (plataforma, account_id)
);

insert into anuncio_contas (plataforma, account_id, nome, business_id)
values ('meta', 'act_2207499086734446', 'Meta · Slick', '1202659826255083')
on conflict (plataforma, account_id) do nothing;

-- ------------------------------------------------------------------
-- Campanhas e mapeamento → marca
-- ------------------------------------------------------------------
create table if not exists anuncio_campanhas (
  campaign_id text primary key,
  conta_id uuid not null references anuncio_contas(id) on delete cascade,
  nome text not null,
  objetivo text,
  status text,                       -- ACTIVE | PAUSED | ARCHIVED | DELETED
  effective_status text,
  orcamento_diario numeric(12, 2),   -- em reais (o Meta manda em centavos)
  orcamento_total numeric(12, 2),
  atualizado_em timestamptz not null default now()
);

create index if not exists anuncio_campanhas_conta_idx on anuncio_campanhas (conta_id);

create table if not exists anuncio_campanha_marca (
  campaign_id text primary key references anuncio_campanhas(campaign_id) on delete cascade,
  marca_id uuid references anuncio_marcas(id) on delete set null,   -- nulo = sem marca
  origem text not null default 'auto' check (origem in ('auto', 'manual')),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Métricas diárias por anúncio
-- ------------------------------------------------------------------
create table if not exists anuncio_metricas_diarias (
  data date not null,                -- dia no fuso da conta
  ad_id text not null,
  conta_id uuid not null references anuncio_contas(id) on delete cascade,
  campaign_id text not null,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_name text,
  spend numeric(12, 2) not null default 0,
  impressions integer not null default 0,
  reach integer not null default 0,  -- alcance do dia: não pode ser somado entre dias
  clicks integer not null default 0,
  inline_link_clicks integer not null default 0,
  actions jsonb not null default '{}'::jsonb,               -- { action_type: quantidade }
  cost_per_action_type jsonb not null default '{}'::jsonb,  -- { action_type: custo }
  sincronizado_em timestamptz not null default now(),
  primary key (data, ad_id)
);

create index if not exists anuncio_metricas_campanha_idx on anuncio_metricas_diarias (campaign_id, data);
create index if not exists anuncio_metricas_ad_idx on anuncio_metricas_diarias (ad_id);

-- ------------------------------------------------------------------
-- Log das sincronizações
-- ------------------------------------------------------------------
create table if not exists anuncio_sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references anuncio_contas(id) on delete cascade,
  gatilho text not null check (gatilho in ('cron', 'manual')),
  periodo_de date,
  periodo_ate date,
  status text not null default 'rodando' check (status in ('rodando', 'ok', 'parcial', 'erro')),
  linhas integer not null default 0,
  campanhas integer not null default 0,
  chamadas integer not null default 0,
  mensagem text,
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz
);

create index if not exists anuncio_sincronizacoes_conta_idx on anuncio_sincronizacoes (conta_id, iniciado_em desc);

-- ------------------------------------------------------------------
-- Eventos de funil vindos dos produtos
-- ------------------------------------------------------------------
create table if not exists funil_eventos (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references anuncio_marcas(id) on delete cascade,
  evento_id text not null,           -- id do evento no sistema de origem (idempotência)
  tipo text not null check (tipo in ('cadastro', 'ativacao', 'assinatura', 'cancelamento')),
  cliente_ref text not null,         -- id opaco do cliente no produto; nunca e-mail/nome
  ocorrido_em timestamptz not null,
  valor numeric(12, 2),              -- assinatura: valor mensal
  utm_source text,
  utm_campaign text,
  utm_content text,
  ad_id text,
  campaign_id text,                  -- preenchido a partir do ad_id / utm_campaign
  de_anuncio boolean generated always as (
    ad_id is not null
    or lower(coalesce(utm_source, '')) in ('meta', 'facebook', 'instagram', 'fb', 'ig', 'facebook_ads', 'meta_ads')
  ) stored,
  recebido_em timestamptz not null default now(),
  unique (marca_id, evento_id)
);

create index if not exists funil_eventos_marca_idx on funil_eventos (marca_id, ocorrido_em);
create index if not exists funil_eventos_cliente_idx on funil_eventos (marca_id, cliente_ref);
create index if not exists funil_eventos_ad_idx on funil_eventos (ad_id) where ad_id is not null;

-- Liga eventos à campanha: pelo ad_id (via métricas) ou pelo utm_campaign
-- (id numérico ou nome exato). Roda depois de cada sincronização, porque o
-- evento pode chegar antes de o anúncio aparecer nas métricas.
create or replace function anuncio_resolver_eventos() returns integer language plpgsql as $$
declare
  n integer := 0;
  m integer;
begin
  update funil_eventos e set campaign_id = x.campaign_id
    from (select distinct on (ad_id) ad_id, campaign_id from anuncio_metricas_diarias order by ad_id, data desc) x
    where e.campaign_id is null and e.ad_id = x.ad_id;
  get diagnostics m = row_count; n := n + m;

  update funil_eventos e set campaign_id = c.campaign_id
    from anuncio_campanhas c
    where e.campaign_id is null and e.utm_campaign is not null
      and (c.campaign_id = e.utm_campaign or lower(c.nome) = lower(e.utm_campaign));
  get diagnostics m = row_count; n := n + m;
  return n;
end $$;

-- ------------------------------------------------------------------
-- Slick: os leads dos formulários deste painel viram eventos "cadastro".
-- O SITE grava as UTMs como "source"/"campaign"… ou "utm_source"…; vale qualquer um.
-- ------------------------------------------------------------------
create or replace function leads_para_funil() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_marca uuid;
begin
  select id into v_marca from anuncio_marcas where slug = 'slick';
  if v_marca is null then
    return new;
  end if;
  insert into funil_eventos (marca_id, evento_id, tipo, cliente_ref, ocorrido_em, utm_source, utm_campaign, utm_content, ad_id)
  values (
    v_marca, 'lead:' || new.id, 'cadastro', 'lead:' || new.id, new.created_at,
    nullif(coalesce(new.utm->>'utm_source', new.utm->>'source'), ''),
    nullif(coalesce(new.utm->>'utm_campaign', new.utm->>'campaign'), ''),
    nullif(coalesce(new.utm->>'utm_content', new.utm->>'content'), ''),
    case when coalesce(new.utm->>'utm_content', new.utm->>'content') ~ '^\d{6,}$'
      then coalesce(new.utm->>'utm_content', new.utm->>'content') end
  )
  on conflict (marca_id, evento_id) do nothing;
  return new;
end $$;

drop trigger if exists leads_para_funil on leads;
create trigger leads_para_funil after insert on leads
  for each row execute function leads_para_funil();

-- Leads que já existem.
insert into funil_eventos (marca_id, evento_id, tipo, cliente_ref, ocorrido_em, utm_source, utm_campaign, utm_content, ad_id)
select m.id, 'lead:' || l.id, 'cadastro', 'lead:' || l.id, l.created_at,
  nullif(coalesce(l.utm->>'utm_source', l.utm->>'source'), ''),
  nullif(coalesce(l.utm->>'utm_campaign', l.utm->>'campaign'), ''),
  nullif(coalesce(l.utm->>'utm_content', l.utm->>'content'), ''),
  case when coalesce(l.utm->>'utm_content', l.utm->>'content') ~ '^\d{6,}$'
    then coalesce(l.utm->>'utm_content', l.utm->>'content') end
from leads l
cross join anuncio_marcas m
where m.slug = 'slick'
on conflict (marca_id, evento_id) do nothing;

-- ------------------------------------------------------------------
-- RLS: painel (usuário logado) lê e edita; rotas de servidor usam a service role.
-- ------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['anuncio_marcas', 'anuncio_contas', 'anuncio_campanhas', 'anuncio_campanha_marca',
                           'anuncio_metricas_diarias', 'anuncio_sincronizacoes', 'funil_eventos'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'authenticated_all') then
      execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- O hash da chave não precisa chegar ao navegador: o painel lê as outras
-- colunas (sempre com select explícito) e só a service role vê o hash.
revoke select on anuncio_marcas from authenticated, anon;
grant select (id, nome, slug, prefixos, cor, linha, ativo, api_key_criada_em, created_at) on anuncio_marcas to authenticated;

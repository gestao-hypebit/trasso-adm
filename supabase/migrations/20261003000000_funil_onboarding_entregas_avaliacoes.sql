-- Funil de vendas, onboarding de projetos, aprovação de entregas e
-- avaliações (NPS + depoimentos).
--
-- 1. Funil       → leads ganham a etapa "proposta", valor estimado, motivo de
--                  perda e um histórico de etapas (tempo em cada etapa).
--                  Propostas enviadas/aprovadas movem o lead sozinhas.
-- 2. Onboarding  → checklist + briefing por projeto, respondido no portal.
-- 3. Entregas    → cliente aprova ou pede ajustes pelo portal; cada rodada
--                  fica registrada.
-- 4. Avaliações  → NPS + depoimento ao concluir o projeto.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

-- ==================================================================
-- 1. FUNIL DE VENDAS
-- ==================================================================

alter table leads drop constraint if exists leads_status_check;
alter table leads add constraint leads_status_check
  check (status in ('novo', 'em_contato', 'qualificado', 'proposta', 'convertido', 'descartado'));

alter table leads add column if not exists valor_estimado numeric(12, 2);
alter table leads add column if not exists motivo_perda text;
alter table leads add column if not exists etapa_desde timestamptz;

update leads set etapa_desde = coalesce(updated_at, created_at) where etapa_desde is null;
alter table leads alter column etapa_desde set default now();
alter table leads alter column etapa_desde set not null;

-- Toda mudança de etapa fica registrada: dá o tempo médio em cada etapa
-- e até onde cada lead chegou antes de ser perdido.
create table if not exists lead_historico (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  de text,
  para text not null,
  created_at timestamptz not null default now()
);

create index if not exists lead_historico_lead_idx on lead_historico (lead_id, created_at);

alter table lead_historico enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'lead_historico' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on lead_historico
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Leads que já existiam entram com a etapa atual como ponto de partida.
insert into lead_historico (lead_id, de, para, created_at)
select l.id, null, l.status, l.created_at
from leads l
where not exists (select 1 from lead_historico h where h.lead_id = l.id);

create or replace function leads_marcar_etapa() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.etapa_desde := now();
  end if;
  return new;
end $$;

drop trigger if exists leads_marcar_etapa on leads;
create trigger leads_marcar_etapa before update of status on leads
  for each row execute function leads_marcar_etapa();

create or replace function leads_registrar_etapa() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into lead_historico (lead_id, de, para) values (new.id, null, new.status);
  elsif new.status is distinct from old.status then
    insert into lead_historico (lead_id, de, para) values (new.id, old.status, new.status);
  end if;
  return null;
end $$;

drop trigger if exists leads_registrar_etapa on leads;
create trigger leads_registrar_etapa after insert or update of status on leads
  for each row execute function leads_registrar_etapa();

-- Proposta enviada → lead do cliente vai para "proposta".
-- Proposta aprovada → lead vai para "convertido" (fechado).
-- Recusada não mexe: pode haver nova proposta ou o lead ser marcado como perdido à mão.
create or replace function propostas_mover_funil() returns trigger language plpgsql as $$
begin
  if new.cliente_id is null then
    return null;
  end if;
  if new.status = 'aprovada' then
    update leads
      set status = 'convertido', valor_estimado = coalesce(valor_estimado, new.valor_final), updated_at = now()
      where cliente_id = new.cliente_id and status not in ('convertido', 'descartado');
  elsif new.status in ('enviada', 'em_negociacao') then
    update leads
      set status = 'proposta', valor_estimado = coalesce(valor_estimado, new.valor_final), updated_at = now()
      where cliente_id = new.cliente_id and status in ('novo', 'em_contato', 'qualificado');
  end if;
  return null;
end $$;

drop trigger if exists propostas_mover_funil on propostas;
create trigger propostas_mover_funil after insert or update of status on propostas
  for each row execute function propostas_mover_funil();

-- ==================================================================
-- 2. ONBOARDING (checklist + briefing)
-- ==================================================================

create table if not exists onboarding_itens (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  titulo text not null,
  descricao text,
  -- Quem precisa fazer: o cliente (aparece no portal) ou a agência.
  responsavel text not null default 'cliente' check (responsavel in ('cliente', 'agencia')),
  concluido boolean not null default false,
  concluido_em timestamptz,
  concluido_por text check (concluido_por in ('cliente', 'agencia')),
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_itens_projeto_idx on onboarding_itens (projeto_id, ordem);

alter table onboarding_itens enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'onboarding_itens' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on onboarding_itens
      for all to authenticated using (true) with check (true);
  end if;
end $$;

create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null unique references projetos(id) on delete cascade,
  -- [{ chave, rotulo, tipo: 'texto' | 'textarea' | 'link', ajuda?, obrigatorio }]
  perguntas jsonb not null default '[]'::jsonb,
  -- { chave: valor }
  respostas jsonb not null default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('pendente', 'respondido')),
  respondido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table briefings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'briefings' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on briefings
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ==================================================================
-- 3. ENTREGAS (aprovação pelo cliente)
-- ==================================================================

-- Quantas rodadas de ajuste o projeto inclui. Nulo = sem limite definido.
alter table projetos add column if not exists revisoes_inclusas integer check (revisoes_inclusas >= 0);

create table if not exists entregas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'outro' check (tipo in ('layout', 'versao_teste', 'entrega_final', 'outro')),
  descricao text,
  link text,
  status text not null default 'aguardando' check (status in ('aguardando', 'ajustes', 'aprovada')),
  rodada integer not null default 1,
  enviada_em timestamptz not null default now(),
  aprovada_em timestamptz,
  aprovada_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entregas_projeto_idx on entregas (projeto_id, created_at);

alter table entregas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'entregas' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on entregas
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Linha do tempo de cada entrega: versões enviadas, ajustes pedidos, aprovação.
create table if not exists entrega_eventos (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references entregas(id) on delete cascade,
  tipo text not null check (tipo in ('enviada', 'ajustes', 'aprovada')),
  rodada integer not null,
  autor text not null check (autor in ('cliente', 'agencia')),
  nome text,
  comentario text,
  link text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists entrega_eventos_entrega_idx on entrega_eventos (entrega_id, created_at);

alter table entrega_eventos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'entrega_eventos' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on entrega_eventos
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ==================================================================
-- 4. AVALIAÇÕES (NPS + depoimentos)
-- ==================================================================

create table if not exists avaliacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  projeto_id uuid references projetos(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'respondida')),
  nota integer check (nota between 0 and 10),
  comentario text,
  depoimento text,
  autoriza_publicar boolean not null default false,
  nome_exibicao text,
  cargo_empresa text,
  -- Depoimento escolhido para usar no site/propostas.
  destaque boolean not null default false,
  solicitada_em timestamptz not null default now(),
  respondida_em timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists avaliacoes_projeto_unico on avaliacoes (projeto_id) where projeto_id is not null;
create index if not exists avaliacoes_cliente_idx on avaliacoes (cliente_id);

alter table avaliacoes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'avaliacoes' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on avaliacoes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Projeto concluído → pedido de avaliação aparece no portal do cliente.
create or replace function projetos_pedir_avaliacao() returns trigger language plpgsql as $$
begin
  if new.status = 'concluido' and new.status is distinct from old.status and new.cliente_id is not null then
    insert into avaliacoes (cliente_id, projeto_id)
    values (new.cliente_id, new.id)
    on conflict (projeto_id) where projeto_id is not null do nothing;
  end if;
  return null;
end $$;

drop trigger if exists projetos_pedir_avaliacao on projetos;
create trigger projetos_pedir_avaliacao after update of status on projetos
  for each row execute function projetos_pedir_avaliacao();

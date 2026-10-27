-- Briefing de clientes de social media.
--
-- Cada briefing é um formulário que vai para o cliente por um link público
-- (/briefing/<token>). Ele responde pelo celular e as respostas ficam salvas
-- aqui, para consultar na hora de montar o planejamento.
--
--   social_briefings  cliente + modelo de perguntas + respostas
--
-- As perguntas de cada modelo ficam no código (lib/social/briefing.ts).
-- Um cliente pode ter vários briefings; o painel mostra o mais recente.
--
-- O link público não usa RLS para anon: a página e a gravação passam pelo
-- servidor (service role), que valida o token e só toca naquele briefing.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

create table if not exists social_briefings (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  modelo text not null check (modelo in ('perfil_novo', 'perfil_existente')),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'enviado' check (status in ('enviado', 'respondido')),
  respostas jsonb not null default '{}'::jsonb,   -- chave da pergunta → valor (texto ou lista)
  created_at timestamptz not null default now(),
  respondido_em timestamptz
);

create index if not exists social_briefings_cliente_idx on social_briefings (cliente_id, created_at desc);

alter table social_briefings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'social_briefings' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on social_briefings for all to authenticated using (true) with check (true);
  end if;
end $$;

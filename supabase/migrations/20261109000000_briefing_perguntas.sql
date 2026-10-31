-- Perguntas de briefing editáveis pelo painel.
--
--   social_briefings.perguntas  perguntas daquele briefing (cópia do modelo no
--                               momento em que foi gerado, ajustável por cliente).
--                               null nos briefings antigos: valem as do código.
--   briefing_modelos            perguntas padrão de cada modelo, quando alguém
--                               salva um ajuste "como padrão". Sem linha aqui,
--                               valem as do código (lib/social/briefing.ts).
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute. É idempotente.

alter table social_briefings add column if not exists perguntas jsonb;

create table if not exists briefing_modelos (
  modelo text primary key,
  perguntas jsonb not null,
  updated_at timestamptz not null default now()
);

alter table briefing_modelos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'briefing_modelos' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on briefing_modelos for all to authenticated using (true) with check (true);
  end if;
end $$;

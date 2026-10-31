-- Briefing de site pelo mesmo link público do briefing de social media.
--
-- A tabela social_briefings passa a guardar também o briefing de
-- desenvolvimento de site (modelo 'site'). Ele fica ligado ao projeto,
-- aparece na aba "Briefing" do projeto e, quando o cliente responde,
-- marca sozinho o item "Responder o briefing" do onboarding.
--
--   projeto_id  projeto ao qual o briefing pertence (só no briefing de site)
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute. É idempotente.

alter table social_briefings add column if not exists projeto_id uuid references projetos(id) on delete set null;

create index if not exists social_briefings_projeto_idx on social_briefings (projeto_id, created_at desc);

alter table social_briefings drop constraint if exists social_briefings_modelo_check;
alter table social_briefings add constraint social_briefings_modelo_check
  check (modelo in ('perfil_novo', 'perfil_existente', 'site'));

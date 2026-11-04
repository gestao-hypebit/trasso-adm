-- Modelo de briefing de social media para quem não é loja (modelo 'empresa'):
-- serviços, consultorias, profissionais liberais.
--
-- As perguntas ficam no código (lib/social/briefing.ts). Aqui só liberamos o
-- nome do modelo na tabela.
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute. É idempotente.

alter table social_briefings drop constraint if exists social_briefings_modelo_check;
alter table social_briefings add constraint social_briefings_modelo_check
  check (modelo in ('perfil_novo', 'perfil_existente', 'empresa', 'site'));

-- Prévias de site: progresso da geração.
--
-- A geração do site pode passar do tempo máximo de uma função na Vercel e ser
-- encerrada no meio. Agora o HTML já escrito vai sendo salvo em html_parcial
-- (e updated_at serve de sinal de vida); se a função cair, a tela pede para a
-- IA continuar de onde parou em vez de recomeçar.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

alter table site_previas add column if not exists html_parcial text;

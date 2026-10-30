-- Metas diárias: quantos dos contatos do dia converteram (ex: das 40
-- mensagens oferecendo o Catálogo Place, quantas viraram cliente).
--
-- Rode depois de 20261106000000_metas_diarias.sql. Assim como as migrations
-- anteriores, cole este arquivo inteiro no SQL Editor do painel do Supabase e
-- execute manualmente. É idempotente.

alter table metas_diarias_registros
  add column if not exists convertidos integer not null default 0 check (convertidos >= 0);

-- Metas que não têm conversão (ex: postar no Instagram) escondem o contador.
alter table metas_diarias
  add column if not exists mede_conversao boolean not null default true;

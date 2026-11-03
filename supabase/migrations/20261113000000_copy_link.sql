-- Link só da copy: /copy/<copy_token>. Mostra apenas a copy do site para o
-- cliente aprovar, sem as outras abas do portal. Gerar um novo token na tela
-- de copy desliga o link antigo.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

alter table sites_clientes add column if not exists copy_token uuid not null default gen_random_uuid();

create unique index if not exists sites_clientes_copy_token_idx on sites_clientes (copy_token);

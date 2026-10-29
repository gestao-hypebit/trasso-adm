-- Reunião marcada pelo CRM: o evento da agenda aponta para o lead, assim o
-- lead mostra a reunião (com o Meet) e a agenda sabe de quem é.
--
-- Rode depois de 20261104000000_agenda_google.sql. Assim como as migrations
-- anteriores, cole este arquivo inteiro no SQL Editor do painel do Supabase e
-- execute manualmente. É idempotente.

alter table eventos add column if not exists lead_id uuid references leads(id) on delete set null;
create index if not exists eventos_lead_idx on eventos (lead_id, data_inicio);

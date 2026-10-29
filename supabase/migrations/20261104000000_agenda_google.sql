-- Agenda + Google Agenda.
--   integracoes            → tokens do Google (só o servidor lê, com a service role).
--   eventos.google_event_id → evento da Slick que também foi criado no Google;
--                             evita mostrar duplicado e permite apagar dos dois lados.
--
-- Cole no SQL Editor do Supabase e execute manualmente. É idempotente.

create table if not exists integracoes (
  tipo text primary key,
  access_token text,
  refresh_token text,
  token_expiry bigint,
  email text,
  created_at timestamptz not null default now()
);

-- Sem policy: nenhum usuário lê os tokens pelo navegador, só as rotas do servidor.
alter table integracoes enable row level security;

alter table eventos add column if not exists google_event_id text;
create index if not exists eventos_google_event_idx on eventos (google_event_id) where google_event_id is not null;

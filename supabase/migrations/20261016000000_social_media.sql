-- Planejamento de social media.
--
-- Um planejamento por cliente e mês. Cada post tem data, redes, formato,
-- legenda e as artes. O planejamento vai para o cliente por um link público
-- (/plano/<token>), onde ele aprova ou pede ajuste em cada post.
--
--   social_planejamentos  cliente + mês (objetivo, status do envio, link)
--   social_posts          os posts do calendário
--   bucket "social"       artes e vídeos dos posts (público, para o link e o PDF)
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

create table if not exists social_planejamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  titulo text not null,
  mes date not null,                        -- sempre o dia 1 do mês planejado
  objetivo text,                            -- foco do mês (aparece para o cliente)
  observacoes text,                         -- anotações internas (não aparecem)
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviado', 'ajustes', 'aprovado')),
  token uuid not null unique default gen_random_uuid(),
  link_ativo boolean not null default true,
  enviado_em timestamptz,
  aprovado_em timestamptz,
  visualizacoes int not null default 0,
  ultima_visualizacao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_planejamentos_mes_idx on social_planejamentos (mes desc);
create index if not exists social_planejamentos_cliente_idx on social_planejamentos (cliente_id);

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  planejamento_id uuid not null references social_planejamentos(id) on delete cascade,
  data date not null,
  horario text,                             -- "18:30"
  redes text[] not null default array['instagram'],
  formato text not null default 'feed'
    check (formato in ('feed', 'carrossel', 'reels', 'stories', 'video', 'artigo')),
  titulo text not null,                     -- tema/pauta do post
  legenda text,
  hashtags text,
  roteiro text,                             -- briefing da arte, texto dos slides ou roteiro do vídeo
  cta text,
  midias text[] not null default '{}',      -- URLs públicas no bucket "social"
  producao text not null default 'ideia'
    check (producao in ('ideia', 'producao', 'pronto', 'agendado', 'publicado')),
  aprovacao text not null default 'pendente'
    check (aprovacao in ('pendente', 'aprovado', 'ajustes')),
  comentario_cliente text,
  respondido_nome text,
  respondido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_posts_planejamento_idx on social_posts (planejamento_id, data);

do $$
declare
  t text;
begin
  foreach t in array array['social_planejamentos', 'social_posts'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'authenticated_all') then
      execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- Conta uma visualização do link do cliente (chamada pelo servidor, sem login).
create or replace function social_planejamento_visualizar(p_token uuid) returns void
language sql security definer set search_path = public as $$
  update social_planejamentos
    set visualizacoes = visualizacoes + 1, ultima_visualizacao = now()
    where token = p_token;
$$;

-- Artes e vídeos dos posts.
insert into storage.buckets (id, name, public)
values ('social', 'social', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'social_authenticated_all') then
    create policy "social_authenticated_all" on storage.objects
      for all to authenticated
      using (bucket_id = 'social')
      with check (bucket_id = 'social');
  end if;
end $$;

-- Anúncios: funil por marca (etapas configuráveis) e eventos dos pixels do Meta.
--
--   anuncio_marcas.funil         → etapas do funil da marca, em ordem:
--                                  [{ "rotulo": "...", "evento": "...", "lateral": false }]
--                                  evento = "impressoes" | "cliques" | "pixel:<Evento>" |
--                                           "produto:<tipo>" | "acao:<action_type do Meta>"
--                                  lateral = saída alternativa (não é o passo seguinte).
--   anuncio_pixels               → pixels da conta (descobertos na sincronização) e a marca de cada um.
--   anuncio_pixel_eventos_diarios→ quantos eventos cada pixel recebeu por dia (todo o tráfego,
--                                  não só anúncio), no fuso de São Paulo.
--
-- Rode depois de 20261030000000_anuncios_historico.sql. Assim como as migrations
-- anteriores, cole este arquivo inteiro no SQL Editor do painel do Supabase e
-- execute manualmente. É idempotente.

alter table anuncio_marcas add column if not exists funil jsonb not null default '[]'::jsonb;
grant select (funil) on anuncio_marcas to authenticated;

update anuncio_marcas set funil = '[
  {"rotulo": "Impressões", "evento": "impressoes"},
  {"rotulo": "Cliques no link", "evento": "cliques"},
  {"rotulo": "Viu a página", "evento": "pixel:PageView"},
  {"rotulo": "Clicou em Teste grátis", "evento": "pixel:InitiateCheckout"},
  {"rotulo": "Cadastrou", "evento": "produto:cadastro"},
  {"rotulo": "Ativou", "evento": "produto:ativacao"},
  {"rotulo": "Assinou", "evento": "produto:assinatura"}
]'::jsonb where slug = 'catalogo-place' and funil = '[]'::jsonb;

update anuncio_marcas set funil = '[
  {"rotulo": "Impressões", "evento": "impressoes"},
  {"rotulo": "Cliques no link", "evento": "cliques"},
  {"rotulo": "Viu a página", "evento": "pixel:PageView"},
  {"rotulo": "Clicou no WhatsApp", "evento": "pixel:Contact", "lateral": true},
  {"rotulo": "Enviou formulário", "evento": "produto:cadastro"}
]'::jsonb where slug = 'slick' and funil = '[]'::jsonb;

update anuncio_marcas set funil = '[
  {"rotulo": "Impressões", "evento": "impressoes"},
  {"rotulo": "Cliques no link", "evento": "cliques"},
  {"rotulo": "Viu a página", "evento": "pixel:PageView"},
  {"rotulo": "Cadastrou", "evento": "produto:cadastro"},
  {"rotulo": "Assinou", "evento": "produto:assinatura"}
]'::jsonb where slug = 'clubelly' and funil = '[]'::jsonb;

-- ------------------------------------------------------------------
-- Pixels
-- ------------------------------------------------------------------
create table if not exists anuncio_pixels (
  pixel_id text primary key,
  conta_id uuid not null references anuncio_contas(id) on delete cascade,
  nome text not null,
  marca_id uuid references anuncio_marcas(id) on delete set null,
  ultimo_disparo timestamptz,
  historico_desde date,              -- dia mais antigo já carregado das estatísticas
  erro text,                         -- última falha ao ler as estatísticas (ex.: sem permissão)
  atualizado_em timestamptz not null default now()
);

create table if not exists anuncio_pixel_eventos_diarios (
  pixel_id text not null references anuncio_pixels(pixel_id) on delete cascade,
  data date not null,                -- dia em São Paulo
  evento text not null,              -- PageView, Lead, InitiateCheckout, evento personalizado…
  quantidade integer not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (pixel_id, data, evento)
);

create index if not exists anuncio_pixel_eventos_data_idx on anuncio_pixel_eventos_diarios (data);

do $$
declare
  t text;
begin
  foreach t in array array['anuncio_pixels', 'anuncio_pixel_eventos_diarios'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'authenticated_all') then
      execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

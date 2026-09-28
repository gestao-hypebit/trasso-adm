-- Formulários de captação (montados no administrativo) e leads recebidos
-- pelo site. O site não fala com o banco: ele chama as rotas
-- /api/publico/formularios/[slug] com a chave LEADS_API_KEY e o servidor
-- grava com a service role.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

-- ------------------------------------------------------------------
-- Formulários
-- ------------------------------------------------------------------
create table if not exists formularios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  titulo text,
  subtitulo text,
  botao_texto text not null default 'Enviar',
  mensagem_sucesso text not null default 'Recebemos sua mensagem! A gente te responde em breve.',
  campos jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table formularios enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'formularios' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on formularios
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ------------------------------------------------------------------
-- Leads
-- ------------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid references formularios(id) on delete set null,
  nome text not null,
  email text,
  telefone text,
  empresa text,
  -- Snapshot das respostas: [{ chave, rotulo, valor }]. Guardar o rótulo
  -- mantém o lead legível mesmo depois que o formulário for editado.
  respostas jsonb not null default '[]'::jsonb,
  status text not null default 'novo'
    check (status in ('novo', 'em_contato', 'qualificado', 'convertido', 'descartado')),
  origem text not null default 'site',
  pagina text,
  utm jsonb,
  cliente_id uuid references clientes(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_status_idx on leads (status);

alter table leads enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'leads' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on leads
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ------------------------------------------------------------------
-- Formulário padrão do site (slug usado pelo SITE: "site-contato")
-- ------------------------------------------------------------------
insert into formularios (slug, nome, titulo, subtitulo, botao_texto, mensagem_sucesso, campos)
values (
  'site-contato',
  'Contato do site',
  'Vamos traçar o próximo projeto?',
  'Conta pra gente o que você quer construir. A gente responde com direção — não com um formulário automático.',
  'Enviar',
  'Recebemos! A gente te responde em até 1 dia útil.',
  '[
    {"id":"nome","chave":"nome","rotulo":"Seu nome","tipo":"texto","placeholder":"Como podemos te chamar?","obrigatorio":true,"largura":"metade"},
    {"id":"empresa","chave":"empresa","rotulo":"Empresa","tipo":"texto","placeholder":"Nome da empresa (opcional)","obrigatorio":false,"largura":"metade"},
    {"id":"email","chave":"email","rotulo":"Seu e-mail","tipo":"email","placeholder":"voce@empresa.com","obrigatorio":true,"largura":"metade"},
    {"id":"telefone","chave":"telefone","rotulo":"WhatsApp","tipo":"telefone","placeholder":"(11) 91234-5678","obrigatorio":true,"largura":"metade"},
    {"id":"tipo_projeto","chave":"tipo_projeto","rotulo":"O que você precisa?","tipo":"multiplas","obrigatorio":true,"largura":"inteira","opcoes":["Site institucional","Landing page","Sistema / software","App","E-commerce","Outro"]},
    {"id":"orcamento","chave":"orcamento","rotulo":"Investimento previsto","tipo":"opcoes","obrigatorio":false,"largura":"inteira","opcoes":["Até R$ 5 mil","R$ 5–15 mil","R$ 15–40 mil","Acima de R$ 40 mil","Ainda não sei"]},
    {"id":"mensagem","chave":"mensagem","rotulo":"Sobre o projeto","tipo":"textarea","placeholder":"Conta rapidamente o que você tem em mente","obrigatorio":true,"largura":"inteira"}
  ]'::jsonb
)
on conflict (slug) do nothing;

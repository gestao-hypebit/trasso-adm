-- Descrição do serviço de cada assinante na tela de MRR e assinaturas
-- (ex.: "Social media", "Software sob demanda").
--
--   chave  quem é o assinante, como a tela identifica: id do cliente,
--          "a:<customer do Asaas>" (só no Asaas) ou "d:<descrição>" (só no financeiro)
--   linha  catalogo_place | agencia (o mesmo cliente pode assinar as duas)
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

create table if not exists assinatura_servicos (
  chave text not null,
  linha text not null check (linha in ('catalogo_place', 'agencia')),
  descricao text not null,
  updated_at timestamptz not null default now(),
  primary key (chave, linha)
);

alter table assinatura_servicos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'assinatura_servicos' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on assinatura_servicos for all to authenticated using (true) with check (true);
  end if;
end $$;

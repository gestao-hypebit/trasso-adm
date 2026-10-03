-- Integração com o Asaas (cobranças e pagamentos).
--
-- Cada cobrança do Asaas vira (ou se liga a) um lançamento de receita:
--   - lancamentos.asaas_payment_id guarda o id da cobrança (único): a mesma
--     cobrança nunca gera dois lançamentos, por mais vezes que chegue.
--   - lancamentos.asaas_criado diz se o lançamento foi criado pela integração
--     (true) ou era um lançamento manual que só foi ligado (false). Lançamento
--     manual ligado nunca tem o valor alterado.
--   - clientes.asaas_customer_id liga o cliente do Asaas ao do sistema (achado
--     pelo CPF/CNPJ ou e-mail na primeira vez).
--   - asaas_eventos registra cada aviso recebido (o Asaas pode mandar repetido).
--   - asaas_pendencias guarda o que precisa de decisão manual.
--   - configuracoes_agencia.asaas_inicio: a integração só vale para cobranças
--     com vencimento a partir dessa data. Nulo = integração desligada.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

alter table configuracoes_agencia add column if not exists asaas_inicio date;

alter table clientes add column if not exists asaas_customer_id text;
create unique index if not exists clientes_asaas_customer_id_key on clientes (asaas_customer_id) where asaas_customer_id is not null;

alter table lancamentos add column if not exists asaas_payment_id text;
alter table lancamentos add column if not exists asaas_criado boolean not null default false;
alter table lancamentos add column if not exists asaas_status text;
alter table lancamentos add column if not exists asaas_invoice_url text;
create unique index if not exists lancamentos_asaas_payment_id_key on lancamentos (asaas_payment_id) where asaas_payment_id is not null;

create table if not exists asaas_eventos (
  id text primary key,            -- id do evento no Asaas (evt_…)
  evento text not null,
  payment_id text,
  payload jsonb not null,
  resultado text,
  erro text,
  created_at timestamptz not null default now()
);

create index if not exists asaas_eventos_created_idx on asaas_eventos (created_at desc);

create table if not exists asaas_pendencias (
  payment_id text primary key,
  motivo text not null check (motivo in ('cliente_nao_encontrado', 'varios_lancamentos', 'cobranca_excluida')),
  detalhes jsonb not null default '{}'::jsonb,
  resolvida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['asaas_eventos', 'asaas_pendencias'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'authenticated_all') then
      execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- Taxa cobrada pelo Asaas em cada pagamento (só nos lançamentos criados pela
-- integração; nos manuais você já pode ter lançado o valor líquido).
insert into categorias_financeiras (nome, tipo)
select 'Taxas Asaas', 'despesa'
where not exists (select 1 from categorias_financeiras where nome = 'Taxas Asaas' and tipo = 'despesa');

-- Separação por frente de negócio: Agência e Catálogo Place.
--
-- Cada lançamento passa a ter uma frente:
--   agencia         → receitas e custos da agência (sites, software, social…)
--   catalogo_place  → mensalidades e custos do Catálogo Place
--   geral           → custos compartilhados (contabilidade, impostos…). Aparece
--                     nas duas frentes e entra separado no resultado.
--
-- Quem lança pode escolher a frente. Se vier vazia, ela é deduzida:
--   1. pela categoria (coluna nova categorias_financeiras.frente);
--   2. pelo cliente (tipo "saas" = Catálogo Place);
--   3. receita sem pista → agência; despesa sem pista → geral.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

alter table categorias_financeiras
  add column if not exists frente text check (frente in ('agencia', 'catalogo_place', 'geral'));

-- Categorias que já dizem a frente. As genéricas (Outros, Impostos…) ficam
-- sem frente e caem nas regras pelo cliente / tipo.
update categorias_financeiras set frente = 'catalogo_place'
  where frente is null and nome ~* 'cat[aá]logo';
update categorias_financeiras set frente = 'agencia'
  where frente is null and tipo = 'receita'
    and nome ~* '(site|software|social|servi[cç]os prestados|identidade|tr[aá]fego|marketing)';

alter table lancamentos
  add column if not exists frente text check (frente in ('agencia', 'catalogo_place', 'geral'));

create or replace function lancamentos_definir_frente() returns trigger language plpgsql as $$
declare
  v_frente text;
  v_tipo_cliente text;
begin
  if new.frente is not null then
    return new;
  end if;
  if new.categoria_id is not null then
    select frente into v_frente from categorias_financeiras where id = new.categoria_id;
  end if;
  if v_frente is null and new.cliente_id is not null then
    select tipo into v_tipo_cliente from clientes where id = new.cliente_id;
    if v_tipo_cliente = 'saas' then
      v_frente := 'catalogo_place';
    elsif v_tipo_cliente in ('agencia', 'ambos') then
      v_frente := 'agencia';
    end if;
  end if;
  new.frente := coalesce(v_frente, case when new.tipo = 'receita' then 'agencia' else 'geral' end);
  return new;
end $$;

drop trigger if exists lancamentos_definir_frente on lancamentos;
create trigger lancamentos_definir_frente before insert or update on lancamentos
  for each row execute function lancamentos_definir_frente();

-- Lançamentos que já existem: o trigger preenche a frente ao "tocar" em cada um.
update lancamentos set frente = null where frente is null;

alter table lancamentos alter column frente set not null;

create index if not exists lancamentos_frente_idx on lancamentos (frente);

-- ------------------------------------------------------------------
-- Stripe não é usado. As colunas e a tabela de assinantes do Stripe ficam
-- no banco para não perder dados sem querer; o painel não usa mais.
-- Para apagar de vez, rode as linhas abaixo (sem os "--"):
--
-- alter table produtos drop column if exists stripe_secret_key;
-- alter table produtos drop column if exists stripe_webhook_secret;
-- alter table produtos drop column if exists last_synced_at;
-- drop table if exists saas_clientes;
-- ------------------------------------------------------------------

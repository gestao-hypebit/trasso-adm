-- Clubelly: segundo SaaS da agência, separado do Catálogo Place em tudo
-- (financeiro, dashboard, MRR e assinaturas, metas e clientes).
--
-- Nova frente/linha:
--   clubelly  → mensalidades e custos da Clubelly
--
-- O cliente continua com tipo "saas" (só SaaS) ou "ambos" (agência + SaaS).
-- Qual SaaS é vem do produto do cliente (clientes.produto_id → produtos):
-- produto com "Clubelly" no nome = Clubelly; senão (ou sem produto) = Catálogo Place.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

-- ------------------------------------------------------------------
-- Libera 'clubelly' nas checagens de frente/linha
-- ------------------------------------------------------------------
-- As checagens antigas foram criadas sem nome: apaga qualquer uma que
-- fale em catalogo_place e cria de novo, já com a Clubelly.
do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass as tabela, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('categorias_financeiras'::regclass, 'lancamentos'::regclass, 'metas_mensais'::regclass,
                       'metas_movimentacoes'::regclass, 'assinatura_servicos'::regclass)
      and pg_get_constraintdef(oid) ~ 'catalogo_place'
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
  end loop;
end $$;

alter table categorias_financeiras add constraint categorias_financeiras_frente_check
  check (frente in ('agencia', 'catalogo_place', 'clubelly', 'geral'));
alter table lancamentos add constraint lancamentos_frente_check
  check (frente in ('agencia', 'catalogo_place', 'clubelly', 'geral'));
alter table metas_mensais add constraint metas_mensais_frente_check
  check (frente in ('catalogo_place', 'clubelly', 'trasso'));
alter table metas_movimentacoes add constraint metas_movimentacoes_frente_check
  check (frente in ('catalogo_place', 'clubelly', 'trasso'));
alter table assinatura_servicos add constraint assinatura_servicos_linha_check
  check (linha in ('catalogo_place', 'clubelly', 'agencia'));

-- ------------------------------------------------------------------
-- Produto e categoria da Clubelly
-- ------------------------------------------------------------------
insert into produtos (nome, tipo, cor, ativo)
select 'Clubelly', 'saas', '#38BDF8', true
where not exists (select 1 from produtos where nome ~* 'clubelly');

insert into categorias_financeiras (nome, tipo, frente, recorrente)
select 'Clubelly', 'receita', 'clubelly', true
where not exists (select 1 from categorias_financeiras where tipo = 'receita' and nome ~* 'clubelly');

update categorias_financeiras set frente = 'clubelly'
  where nome ~* 'clubelly' and frente is distinct from 'clubelly';

-- ------------------------------------------------------------------
-- Frente deduzida do lançamento: cliente "saas" segue o produto
-- ------------------------------------------------------------------
create or replace function lancamentos_definir_frente() returns trigger language plpgsql as $$
declare
  v_frente text;
  v_tipo_cliente text;
  v_produto text;
begin
  if new.frente is not null then
    return new;
  end if;
  if new.categoria_id is not null then
    select frente into v_frente from categorias_financeiras where id = new.categoria_id;
  end if;
  if v_frente is null and new.cliente_id is not null then
    select c.tipo, p.nome into v_tipo_cliente, v_produto
      from clientes c left join produtos p on p.id = c.produto_id
      where c.id = new.cliente_id;
    if v_tipo_cliente = 'saas' then
      v_frente := case when v_produto ~* 'clubelly' then 'clubelly' else 'catalogo_place' end;
    elsif v_tipo_cliente in ('agencia', 'ambos') then
      v_frente := 'agencia';
    end if;
  end if;
  new.frente := coalesce(v_frente, case when new.tipo = 'receita' then 'agencia' else 'geral' end);
  return new;
end $$;

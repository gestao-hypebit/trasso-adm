-- Ajustes depois do primeiro teste do funil:
--
-- 1. Proposta criada (mesmo em rascunho) já move o lead para a etapa
--    "Proposta". Antes só movia quando a proposta era enviada.
-- 2. Leads de clientes que já têm proposta são acertados agora.
-- 3. Converter proposta em contrato falhava com "new row violates
--    row-level security policy for table contratos": faltava a política
--    de acesso para usuários logados. Garante a mesma política usada no
--    resto do sistema em contratos, projetos e lançamentos (não liga RLS
--    onde estiver desligado; só libera onde estiver bloqueando).
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

-- ------------------------------------------------------------------
-- 1. Proposta em rascunho também move o lead
-- ------------------------------------------------------------------
create or replace function propostas_mover_funil() returns trigger language plpgsql as $$
begin
  if new.cliente_id is null then
    return null;
  end if;
  if new.status = 'aprovada' then
    update leads
      set status = 'convertido', valor_estimado = coalesce(valor_estimado, new.valor_final), updated_at = now()
      where cliente_id = new.cliente_id and status not in ('convertido', 'descartado');
  elsif new.status in ('rascunho', 'enviada', 'em_negociacao') then
    update leads
      set status = 'proposta', valor_estimado = coalesce(valor_estimado, new.valor_final), updated_at = now()
      where cliente_id = new.cliente_id and status in ('novo', 'em_contato', 'qualificado');
  end if;
  return null;
end $$;

-- ------------------------------------------------------------------
-- 2. Acerto dos leads que já têm proposta
-- ------------------------------------------------------------------
update leads l
set status = 'convertido', valor_estimado = coalesce(l.valor_estimado, p.valor_final), updated_at = now()
from (
  select distinct on (cliente_id) cliente_id, valor_final
  from propostas
  where status = 'aprovada' and cliente_id is not null
  order by cliente_id, created_at desc
) p
where l.cliente_id = p.cliente_id and l.status not in ('convertido', 'descartado');

update leads l
set status = 'proposta', valor_estimado = coalesce(l.valor_estimado, p.valor_final), updated_at = now()
from (
  select distinct on (cliente_id) cliente_id, valor_final
  from propostas
  where status in ('rascunho', 'enviada', 'em_negociacao') and cliente_id is not null
  order by cliente_id, created_at desc
) p
where l.cliente_id = p.cliente_id and l.status in ('novo', 'em_contato', 'qualificado');

-- ------------------------------------------------------------------
-- 3. Acesso de usuários logados às tabelas da conversão em contrato
-- ------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['contratos', 'projetos', 'lancamentos'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'admin_authenticated_all') then
      execute format(
        'create policy "admin_authenticated_all" on %I for all to authenticated using (true) with check (true)',
        t
      );
    end if;
  end loop;
end $$;

-- Exclusão de cliente pelo painel (botão "Excluir" na página do cliente).
--
-- Várias tabelas apontam para clientes sem "on delete cascade" (propostas,
-- contratos, projetos, lançamentos…), então um delete simples falha. Esta
-- função apaga tudo do cliente numa única transação: ou apaga tudo, ou nada.
--
-- Apaga:   projetos (com tarefas, horas, onboarding, entregas), propostas,
--          contratos, lançamentos, indicações em que ele foi o indicado,
--          interações e avaliações.
-- Mantém:  leads (ficam sem cliente), eventos da agenda e indicadores
--          (perdem o vínculo), movimentações de metas (só guardam o nome).
--
-- Roda com as permissões de quem chama (usuário logado do painel).
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

create or replace function excluir_cliente(p_cliente_id uuid) returns void
language plpgsql
security invoker
as $$
declare
  v_projetos uuid[];
  v_contratos uuid[];
  v_propostas uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_projetos from projetos where cliente_id = p_cliente_id;
  select coalesce(array_agg(id), '{}') into v_contratos from contratos where cliente_id = p_cliente_id;
  select coalesce(array_agg(id), '{}') into v_propostas from propostas where cliente_id = p_cliente_id;

  -- Lançamentos do cliente ou dos projetos dele (comissões caem junto).
  delete from lancamentos where cliente_id = p_cliente_id or projeto_id = any(v_projetos);

  -- Indicações em que este cliente foi o indicado; como indicador, só perde o vínculo.
  if to_regclass('public.indicacoes') is not null then
    execute 'delete from indicacoes where cliente_indicado_id = $1' using p_cliente_id;
  end if;
  if to_regclass('public.indicadores') is not null then
    execute 'update indicadores set cliente_id = null where cliente_id = $1' using p_cliente_id;
  end if;

  if to_regclass('public.eventos') is not null then
    execute 'update eventos set cliente_id = null where cliente_id = $1' using p_cliente_id;
    execute 'update eventos set projeto_id = null where projeto_id = any($1)' using v_projetos;
  end if;

  delete from projetos where id = any(v_projetos);

  -- Projetos/contratos de outros clientes que apontem para estes registros só perdem o vínculo.
  update projetos set contrato_id = null where contrato_id = any(v_contratos);
  delete from contratos where id = any(v_contratos);

  update contratos set proposta_id = null where proposta_id = any(v_propostas);
  delete from propostas where id = any(v_propostas);

  -- interações e avaliações caem em cascata; leads ficam com cliente_id nulo.
  delete from clientes where id = p_cliente_id;

  if not found then
    raise exception 'Cliente não encontrado ou sem permissão para excluir.';
  end if;
end $$;

grant execute on function excluir_cliente(uuid) to authenticated;

-- Garante que o painel consiga apagar nas tabelas envolvidas (mesma política
-- do resto do sistema; não liga RLS onde estiver desligado).
do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'propostas', 'proposta_itens', 'interacoes', 'tarefas'] loop
    if to_regclass('public.' || t) is not null
      and not exists (select 1 from pg_policies where tablename = t and policyname = 'admin_authenticated_all') then
      execute format(
        'create policy "admin_authenticated_all" on %I for all to authenticated using (true) with check (true)',
        t
      );
    end if;
  end loop;
end $$;

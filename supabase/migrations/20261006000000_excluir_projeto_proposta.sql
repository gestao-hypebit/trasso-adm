-- Exclusão de projeto e de proposta pelo painel.
--
-- Proposta: contratos apontam para a proposta sem cascade, então o delete
-- falhava em silêncio quando ela já tinha virado contrato. Agora o contrato
-- fica, só perde o vínculo com a proposta.
--
-- Projeto: lançamentos e eventos apontam para o projeto sem cascade. Quem
-- exclui escolhe se os lançamentos do projeto vão junto ou só ficam sem
-- projeto (continuam no financeiro, ligados ao cliente). Tarefas, horas,
-- onboarding, entregas e avaliação do projeto são apagados.
--
-- Roda com as permissões de quem chama (usuário logado do painel).
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

create or replace function excluir_proposta(p_proposta_id uuid) returns void
language plpgsql
security invoker
as $$
begin
  update contratos set proposta_id = null where proposta_id = p_proposta_id;
  delete from proposta_itens where proposta_id = p_proposta_id;
  delete from propostas where id = p_proposta_id;
  if not found then
    raise exception 'Proposta não encontrada ou sem permissão para excluir.';
  end if;
end $$;

grant execute on function excluir_proposta(uuid) to authenticated;

create or replace function excluir_projeto(p_projeto_id uuid, p_apagar_lancamentos boolean default false) returns void
language plpgsql
security invoker
as $$
begin
  if p_apagar_lancamentos then
    delete from lancamentos where projeto_id = p_projeto_id;
  else
    update lancamentos set projeto_id = null where projeto_id = p_projeto_id;
  end if;

  if to_regclass('public.eventos') is not null then
    execute 'update eventos set projeto_id = null where projeto_id = $1' using p_projeto_id;
  end if;

  delete from tarefas where projeto_id = p_projeto_id;
  delete from projetos where id = p_projeto_id;
  if not found then
    raise exception 'Projeto não encontrado ou sem permissão para excluir.';
  end if;
end $$;

grant execute on function excluir_projeto(uuid, boolean) to authenticated;

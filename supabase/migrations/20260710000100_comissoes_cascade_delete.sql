-- Corrige as FKs de indicadores/indicações/comissões para permitir exclusão.
--
-- Sem isso, excluir uma despesa (lançamento) gerada por comissão dá 409
-- (foreign key violation), porque `comissoes.lancamento_id` bloqueava a
-- exclusão do lançamento enquanto a comissão existisse. E não dava pra
-- excluir indicadores/indicações que já tivessem comissões geradas.
--
-- Cole no SQL Editor do Supabase e execute manualmente (mesmo fluxo da
-- migration anterior).
--
-- Comportamento resultante:
--   - Excluir um lançamento (despesa) agora exclui em cascata a comissão
--     que apontava pra ele (a despesa em si é sempre a fonte da verdade).
--   - Excluir uma indicação exclui em cascata as comissões geradas por ela
--     (mas NÃO exclui os lançamentos/despesas já gerados — esses ficam no
--     histórico do Financeiro, sem vínculo).
--   - Excluir um indicador exclui em cascata suas indicações (e por
--     tabela, as comissões delas), pelo mesmo motivo acima.

alter table comissoes drop constraint if exists comissoes_lancamento_id_fkey;
alter table comissoes add constraint comissoes_lancamento_id_fkey
  foreign key (lancamento_id) references lancamentos(id) on delete cascade;

alter table comissoes drop constraint if exists comissoes_indicacao_id_fkey;
alter table comissoes add constraint comissoes_indicacao_id_fkey
  foreign key (indicacao_id) references indicacoes(id) on delete cascade;

alter table comissoes drop constraint if exists comissoes_indicador_id_fkey;
alter table comissoes add constraint comissoes_indicador_id_fkey
  foreign key (indicador_id) references indicadores(id) on delete cascade;

alter table indicacoes drop constraint if exists indicacoes_indicador_id_fkey;
alter table indicacoes add constraint indicacoes_indicador_id_fkey
  foreign key (indicador_id) references indicadores(id) on delete cascade;

-- Planejamento de social media por período (ex.: do dia 20 ao dia 19 do mês seguinte).
--
--   social_planejamentos.mes       passa a ser o primeiro dia do período (qualquer dia)
--   social_planejamentos.data_fim  último dia do período; vazio = até o fim do mês de "mes"
--
-- Os planejamentos que já existem continuam como mês cheio (data_fim vazio).
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

alter table social_planejamentos add column if not exists data_fim date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'social_planejamentos_periodo_check') then
    alter table social_planejamentos
      add constraint social_planejamentos_periodo_check check (data_fim is null or data_fim >= mes);
  end if;
end $$;

comment on column social_planejamentos.mes is 'Primeiro dia do período planejado';
comment on column social_planejamentos.data_fim is 'Último dia do período; vazio = fim do mês de "mes"';

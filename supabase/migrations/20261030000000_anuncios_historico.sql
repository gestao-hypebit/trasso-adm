-- Anúncios: histórico completo do Meta (até 37 meses) em vez de só 90 dias.
--
-- A carga agora anda de trás para frente, a partir de hoje:
--   anuncio_contas.historico_desde       → dia mais antigo já carregado
--   anuncio_contas.backfill_concluido_em → preenchido quando chegou aos 37 meses
-- A coluna backfill_proximo (carga de 90 dias para frente) deixa de existir.
--
-- Rode depois de 20261029000000_anuncios.sql. Assim como as migrations
-- anteriores, cole este arquivo inteiro no SQL Editor do painel do Supabase
-- e execute manualmente. É idempotente.

alter table anuncio_contas add column if not exists historico_desde date;

-- Conta que já tinha feito a carga de 90 dias: continua dali para trás.
-- Carga de 90 dias pela metade (ia para frente, pode ter buraco): recomeça de hoje.
-- Nada é duplicado, as métricas são gravadas por data + anúncio.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'anuncio_contas' and column_name = 'backfill_proximo') then
    update anuncio_contas c set
      historico_desde = case when c.backfill_concluido_em is not null then
        coalesce((select min(m.data) from anuncio_metricas_diarias m where m.conta_id = c.id), current_date - 89)
      end,
      backfill_concluido_em = null
    where c.historico_desde is null;
    alter table anuncio_contas drop column backfill_proximo;
  end if;
end $$;

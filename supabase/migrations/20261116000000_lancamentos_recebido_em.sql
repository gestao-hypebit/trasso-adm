-- Dia em que o dinheiro entrou de verdade (usado no "Recebido hoje" do topo do painel).
--
--   lancamentos.recebido_em  data do recebimento. `data` não serve para isso:
--                            nas cobranças do Asaas ela é o vencimento.
--
-- Quem preenche:
--   - integração do Asaas: manda a data do pagamento informada pelo Asaas;
--   - este gatilho: cobre o resto. Marcou como recebido → hoje. Lançamento já
--     criado como recebido → a data dele (ou hoje, se for futura). Saiu de
--     recebido (estorno, voltou a pendente) → limpa.
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute. É idempotente.

alter table lancamentos add column if not exists recebido_em date;

create index if not exists lancamentos_recebido_em_idx on lancamentos (recebido_em) where recebido_em is not null;

create or replace function lancamentos_marcar_recebido() returns trigger language plpgsql as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if new.status <> 'recebido' then
    new.recebido_em := null;
  elsif new.recebido_em is null then
    new.recebido_em := case when tg_op = 'INSERT' then least(new.data, hoje) else hoje end;
  end if;
  return new;
end $$;

drop trigger if exists lancamentos_marcar_recebido on lancamentos;
create trigger lancamentos_marcar_recebido before insert or update of status on lancamentos
  for each row execute function lancamentos_marcar_recebido();

-- O que já foi recebido: sem informação melhor, vale a data do lançamento.
update lancamentos
set recebido_em = least(data, (now() at time zone 'America/Sao_Paulo')::date)
where status = 'recebido' and recebido_em is null;

-- Cobranças do Asaas: usa a data do pagamento que veio no último aviso de cada uma.
update lancamentos l
set recebido_em = e.pago
from (
  select distinct on (payload->'payment'->>'id')
    payload->'payment'->>'id' as payment_id,
    left(coalesce(payload->'payment'->>'clientPaymentDate', payload->'payment'->>'paymentDate'), 10)::date as pago
  from asaas_eventos
  where coalesce(payload->'payment'->>'clientPaymentDate', payload->'payment'->>'paymentDate') is not null
  order by payload->'payment'->>'id', created_at desc
) e
where l.asaas_payment_id = e.payment_id and l.status = 'recebido';

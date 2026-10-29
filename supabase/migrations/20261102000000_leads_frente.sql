-- De qual negócio é cada lead: Slick (agência), Catálogo Place ou Clubelly.
-- Mesmos valores da coluna `frente` dos lançamentos, para cruzar o lead com o
-- investimento em tráfego lançado à mão no financeiro.
--
-- Cole no SQL Editor do Supabase e execute manualmente. É idempotente.

alter table leads
  add column if not exists frente text not null default 'agencia'
  check (frente in ('agencia', 'catalogo_place', 'clubelly'));

-- Leads que já existem: a origem antiga dizia o produto em alguns casos.
update leads set frente = 'catalogo_place' where origem = 'catalogo_place' and frente = 'agencia';
update leads set frente = 'clubelly' where origem = 'clubelly' and frente = 'agencia';

create index if not exists leads_frente_idx on leads (frente);

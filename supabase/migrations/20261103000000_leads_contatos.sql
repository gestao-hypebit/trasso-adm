-- Follow-up dos leads:
--   leads.proximo_contato → dia combinado para falar de novo (aparece no card e
--                           no filtro "Para hoje" do funil).
--   lead_contatos         → cada tentativa de contato (WhatsApp, ligação...) e o
--                           resultado. Dá quantos toques cada venda precisou.
--
-- Cole no SQL Editor do Supabase e execute manualmente. É idempotente.

alter table leads add column if not exists proximo_contato date;

create index if not exists leads_proximo_contato_idx on leads (proximo_contato) where proximo_contato is not null;

create table if not exists lead_contatos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  tipo text not null check (tipo in ('whatsapp', 'ligacao', 'email', 'direct', 'reuniao', 'outro')),
  resultado text not null check (resultado in ('sem_resposta', 'respondeu', 'agendou', 'recusou')),
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists lead_contatos_lead_idx on lead_contatos (lead_id, created_at desc);

alter table lead_contatos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'lead_contatos' and policyname = 'authenticated_all') then
    create policy "authenticated_all" on lead_contatos
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Link curto da proposta: /proposta/<slug>, ex.: /proposta/dj-turin-k7m2.
--
-- O slug é o nome do cliente + 4 caracteres aleatórios. O sufixo impede que
-- alguém troque o nome no link e abra a proposta de outro cliente.
-- É gerado uma vez (ao enviar a proposta) e não muda mais.
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute. É idempotente.

alter table propostas add column if not exists slug text;
create unique index if not exists propostas_slug_key on propostas (slug) where slug is not null;

-- "DJ Turin" → "dj-turin"
create or replace function propostas_slug_base(p_nome text) returns text language sql immutable as $$
  select coalesce(nullif(trim(both '-' from left(trim(both '-' from regexp_replace(
    lower(translate(coalesce(p_nome, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+', '-', 'g')), 40)), ''), 'proposta')
$$;

-- Devolve o slug da proposta, gerando se ainda não tiver.
create or replace function propostas_gerar_slug(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_slug text;
  v_base text;
  v_letras constant text := 'abcdefghjkmnpqrstuvwxyz23456789';  -- sem 0/o, 1/l/i
  v_sufixo text;
begin
  select p.slug, propostas_slug_base(c.nome) into v_slug, v_base
    from propostas p left join clientes c on c.id = p.cliente_id
    where p.id = p_id;
  if not found then return null; end if;
  if v_slug is not null then return v_slug; end if;

  loop
    v_sufixo := '';
    for i in 1..4 loop
      v_sufixo := v_sufixo || substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1);
    end loop;
    begin
      update propostas set slug = v_base || '-' || v_sufixo where id = p_id and slug is null returning slug into v_slug;
      if v_slug is null then  -- outro envio gerou ao mesmo tempo
        select slug into v_slug from propostas where id = p_id;
      end if;
      return v_slug;
    exception when unique_violation then
      -- sorteou um slug que já existe: tenta outro
    end;
  end loop;
end $$;

revoke all on function propostas_gerar_slug(uuid) from public, anon;
grant execute on function propostas_gerar_slug(uuid) to authenticated, service_role;

-- Propostas que já foram enviadas ganham o link agora.
select propostas_gerar_slug(id) from propostas where status <> 'rascunho' and slug is null;

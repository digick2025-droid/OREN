-- ============================================================
-- DIGICK Devis — Évolutions v2
-- Proforma, acompte, logo/slogan, offre « DIGICK Startup »,
-- édition de document.
-- ============================================================

-- ------------------------------------------------------------
-- Offre 5000 renommée « DIGICK Startup » + nouvelles features
-- (clé interne 'business' conservée ; « Entreprise » viendra au-dessus)
-- ------------------------------------------------------------
update public.plans
set name = 'DIGICK Startup',
    features = '["catalog", "reports", "proforma", "logo", "advance"]'::jsonb
where key = 'business';

-- ------------------------------------------------------------
-- companies : slogan (affiché sur les documents, offre Startup)
-- ------------------------------------------------------------
alter table public.companies
  add column if not exists slogan text;

-- ------------------------------------------------------------
-- documents : type 'proforma' + acompte
-- ------------------------------------------------------------
alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents
  add constraint documents_type_check
  check (type in ('devis', 'facture', 'proforma'));

alter table public.documents
  add column if not exists advance_amount integer not null default 0
  check (advance_amount >= 0);

alter table public.document_counters drop constraint if exists document_counters_doc_type_check;
alter table public.document_counters
  add constraint document_counters_doc_type_check
  check (doc_type in ('devis', 'facture', 'proforma'));

-- ------------------------------------------------------------
-- Numérotation : PRO- pour les proformas
-- ------------------------------------------------------------
create or replace function public.next_document_number(p_company_id uuid, p_type text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_counter integer;
  v_prefix text;
begin
  insert into public.document_counters (company_id, doc_type, counter)
  values (p_company_id, p_type, 1)
  on conflict (company_id, doc_type)
  do update set counter = public.document_counters.counter + 1
  returning counter into v_counter;

  v_prefix := case p_type
    when 'facture' then 'FAC-'
    when 'proforma' then 'PRO-'
    else 'DEV-'
  end;
  return v_prefix || lpad(v_counter::text, 3, '0');
end;
$$;
revoke execute on function public.next_document_number(uuid, text) from anon, authenticated, public;

-- ------------------------------------------------------------
-- create_document : accepte 'proforma' + acompte (advance)
-- ------------------------------------------------------------
create or replace function public.create_document(p_company_id uuid, p_payload jsonb)
returns public.documents
language plpgsql
security definer set search_path = public
as $$
declare
  v_company public.companies%rowtype;
  v_client public.clients%rowtype;
  v_type text;
  v_item jsonb;
  v_subtotal integer := 0;
  v_discount integer;
  v_net integer;
  v_vat_rate numeric(5, 2);
  v_vat_amount integer;
  v_total integer;
  v_advance integer;
  v_doc public.documents%rowtype;
  v_pos integer := 0;
  v_qty numeric(12, 2);
  v_price integer;
  v_line integer;
begin
  select * into v_company from public.companies
  where id = p_company_id and owner_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  v_type := p_payload->>'type';
  if v_type not in ('devis', 'facture', 'proforma') then
    raise exception 'INVALID_TYPE';
  end if;
  if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 then
    raise exception 'NO_ITEMS';
  end if;

  perform public.assert_quota(p_company_id);

  if p_payload->>'client_id' is not null then
    select * into v_client from public.clients
    where id = (p_payload->>'client_id')::uuid and company_id = p_company_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_price := coalesce((v_item->>'unit_price')::integer, 0);
    v_subtotal := v_subtotal + round(v_qty * v_price)::integer;
  end loop;

  v_discount := least(greatest(coalesce((p_payload->>'discount')::integer, 0), 0), v_subtotal);
  v_net := v_subtotal - v_discount;
  v_vat_rate := case when v_company.vat_enabled then v_company.vat_rate else 0 end;
  v_vat_amount := round(v_net * v_vat_rate / 100)::integer;
  v_total := v_net + v_vat_amount;
  v_advance := least(greatest(coalesce((p_payload->>'advance_amount')::integer, 0), 0), v_total);

  insert into public.documents (
    company_id, client_id, type, number, status, title, issue_date,
    client_name, client_phone,
    subtotal, discount, vat_enabled, vat_rate, vat_amount, total, advance_amount,
    note, conditions, converted_from
  ) values (
    p_company_id,
    v_client.id,
    v_type,
    public.next_document_number(p_company_id, v_type),
    coalesce(p_payload->>'status', 'brouillon'),
    coalesce(p_payload->>'title', ''),
    current_date,
    coalesce(v_client.name, coalesce(p_payload->>'client_name', '')),
    coalesce(v_client.phone, coalesce(p_payload->>'client_phone', '')),
    v_subtotal, v_discount,
    v_company.vat_enabled, v_vat_rate, v_vat_amount, v_total, v_advance,
    coalesce(p_payload->>'note', ''),
    coalesce(p_payload->>'conditions', ''),
    nullif(p_payload->>'converted_from', '')::uuid
  ) returning * into v_doc;

  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_price := coalesce((v_item->>'unit_price')::integer, 0);
    v_line := round(v_qty * v_price)::integer;
    insert into public.document_items (document_id, position, name, unit, quantity, unit_price, line_total)
    values (v_doc.id, v_pos, coalesce(v_item->>'name', '—'),
            coalesce(v_item->>'unit', 'unité'), v_qty, v_price, v_line);
    v_pos := v_pos + 1;
  end loop;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_company_id, auth.uid(), 'document.created', 'document', v_doc.id,
          jsonb_build_object('number', v_doc.number, 'type', v_doc.type, 'total', v_doc.total));

  return v_doc;
end;
$$;
revoke execute on function public.create_document(uuid, jsonb) from anon, public;
grant execute on function public.create_document(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- update_document : réédition d'un document (recalcul + remplace lignes)
-- Ne change ni le numéro ni le type ; ne consomme pas de quota.
-- ------------------------------------------------------------
create or replace function public.update_document(p_document_id uuid, p_payload jsonb)
returns public.documents
language plpgsql
security definer set search_path = public
as $$
declare
  v_company public.companies%rowtype;
  v_existing public.documents%rowtype;
  v_client public.clients%rowtype;
  v_item jsonb;
  v_subtotal integer := 0;
  v_discount integer;
  v_net integer;
  v_vat_rate numeric(5, 2);
  v_vat_amount integer;
  v_total integer;
  v_advance integer;
  v_doc public.documents%rowtype;
  v_pos integer := 0;
  v_qty numeric(12, 2);
  v_price integer;
  v_line integer;
begin
  select d.* into v_existing
  from public.documents d
  join public.companies c on c.id = d.company_id
  where d.id = p_document_id and c.owner_id = auth.uid() and d.deleted_at is null;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_company from public.companies where id = v_existing.company_id;

  if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 then
    raise exception 'NO_ITEMS';
  end if;

  if p_payload->>'client_id' is not null then
    select * into v_client from public.clients
    where id = (p_payload->>'client_id')::uuid and company_id = v_existing.company_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_price := coalesce((v_item->>'unit_price')::integer, 0);
    v_subtotal := v_subtotal + round(v_qty * v_price)::integer;
  end loop;

  v_discount := least(greatest(coalesce((p_payload->>'discount')::integer, 0), 0), v_subtotal);
  v_net := v_subtotal - v_discount;
  v_vat_rate := case when v_company.vat_enabled then v_company.vat_rate else 0 end;
  v_vat_amount := round(v_net * v_vat_rate / 100)::integer;
  v_total := v_net + v_vat_amount;
  v_advance := least(greatest(coalesce((p_payload->>'advance_amount')::integer, 0), 0), v_total);

  update public.documents set
    client_id = coalesce(v_client.id, client_id),
    client_name = coalesce(v_client.name, coalesce(p_payload->>'client_name', client_name)),
    client_phone = coalesce(v_client.phone, coalesce(p_payload->>'client_phone', client_phone)),
    title = coalesce(p_payload->>'title', title),
    subtotal = v_subtotal,
    discount = v_discount,
    vat_enabled = v_company.vat_enabled,
    vat_rate = v_vat_rate,
    vat_amount = v_vat_amount,
    total = v_total,
    advance_amount = v_advance,
    note = coalesce(p_payload->>'note', note),
    conditions = coalesce(p_payload->>'conditions', conditions),
    status = coalesce(p_payload->>'status', status)
  where id = p_document_id
  returning * into v_doc;

  delete from public.document_items where document_id = p_document_id;

  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_price := coalesce((v_item->>'unit_price')::integer, 0);
    v_line := round(v_qty * v_price)::integer;
    insert into public.document_items (document_id, position, name, unit, quantity, unit_price, line_total)
    values (p_document_id, v_pos, coalesce(v_item->>'name', '—'),
            coalesce(v_item->>'unit', 'unité'), v_qty, v_price, v_line);
    v_pos := v_pos + 1;
  end loop;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_existing.company_id, auth.uid(), 'document.updated', 'document', p_document_id,
          jsonb_build_object('number', v_doc.number, 'total', v_doc.total));

  return v_doc;
end;
$$;
revoke execute on function public.update_document(uuid, jsonb) from anon, public;
grant execute on function public.update_document(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- Conversion : devis OU proforma → facture
-- ------------------------------------------------------------
create or replace function public.convert_document_to_invoice(p_document_id uuid)
returns public.documents
language plpgsql
security definer set search_path = public
as $$
declare
  v_src public.documents%rowtype;
  v_new public.documents%rowtype;
begin
  select d.* into v_src
  from public.documents d
  join public.companies c on c.id = d.company_id
  where d.id = p_document_id
    and c.owner_id = auth.uid()
    and d.deleted_at is null;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if v_src.type not in ('devis', 'proforma') then
    raise exception 'NOT_CONVERTIBLE';
  end if;

  perform public.assert_quota(v_src.company_id);

  insert into public.documents (
    company_id, client_id, type, number, status, title, issue_date,
    client_name, client_phone,
    subtotal, discount, vat_enabled, vat_rate, vat_amount, total, advance_amount,
    note, conditions, converted_from
  ) values (
    v_src.company_id, v_src.client_id, 'facture',
    public.next_document_number(v_src.company_id, 'facture'),
    'brouillon', v_src.title, current_date,
    v_src.client_name, v_src.client_phone,
    v_src.subtotal, v_src.discount, v_src.vat_enabled, v_src.vat_rate,
    v_src.vat_amount, v_src.total, v_src.advance_amount,
    v_src.note, v_src.conditions, v_src.id
  ) returning * into v_new;

  insert into public.document_items (document_id, position, name, unit, quantity, unit_price, line_total)
  select v_new.id, position, name, unit, quantity, unit_price, line_total
  from public.document_items
  where document_id = v_src.id and deleted_at is null
  order by position;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_src.company_id, auth.uid(), 'document.converted', 'document', v_new.id,
          jsonb_build_object('from', v_src.number, 'to', v_new.number));

  return v_new;
end;
$$;
revoke execute on function public.convert_document_to_invoice(uuid) from anon, public;
grant execute on function public.convert_document_to_invoice(uuid) to authenticated;

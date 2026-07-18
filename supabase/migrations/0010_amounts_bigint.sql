-- ============================================================
-- OREN — H2 : montants en bigint
--
-- Les colonnes monétaires étaient en `integer` (max ≈ 2,15 milliards).
-- En FCFA, un devis B2B important peut dépasser ce plafond.
-- On passe donc tous les montants en `bigint`.
--
-- ATTENTION côté client : supabase-js (PostgREST) peut renvoyer les
-- `bigint` sous forme de **chaîne** pour préserver la précision.
-- Le parsing est géré dans src/lib/calculations.ts (parseAmount) et
-- les types bruts dans src/types/database.ts.
-- ============================================================

-- ------------------------------------------------------------
-- Colonnes monétaires → bigint
-- (les contraintes CHECK `>= 0` restent valides, indépendantes du type)
-- ------------------------------------------------------------
alter table public.catalog_items
  alter column unit_price type bigint;

alter table public.documents
  alter column subtotal      type bigint,
  alter column discount       type bigint,
  alter column vat_amount     type bigint,
  alter column total          type bigint,
  alter column advance_amount type bigint;

alter table public.document_items
  alter column unit_price type bigint,
  alter column line_total type bigint;

alter table public.payments
  alter column amount type bigint;

alter table public.plans
  alter column price_fcfa              type bigint,
  alter column per_document_price_fcfa type bigint;

-- ------------------------------------------------------------
-- create_document : intermédiaires de calcul en bigint
-- (sinon les casts ::integer tronqueraient avant l'écriture)
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
  v_subtotal bigint := 0;
  v_discount bigint;
  v_net bigint;
  v_vat_rate numeric(5, 2);
  v_vat_amount bigint;
  v_total bigint;
  v_advance bigint;
  v_doc public.documents%rowtype;
  v_pos integer := 0;
  v_qty numeric(12, 2);
  v_price bigint;
  v_line bigint;
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
    v_price := coalesce((v_item->>'unit_price')::bigint, 0);
    v_subtotal := v_subtotal + round(v_qty * v_price)::bigint;
  end loop;

  v_discount := least(greatest(coalesce((p_payload->>'discount')::bigint, 0), 0), v_subtotal);
  v_net := v_subtotal - v_discount;
  v_vat_rate := case when v_company.vat_enabled then v_company.vat_rate else 0 end;
  v_vat_amount := round(v_net * v_vat_rate / 100)::bigint;
  v_total := v_net + v_vat_amount;
  v_advance := least(greatest(coalesce((p_payload->>'advance_amount')::bigint, 0), 0), v_total);

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
    v_price := coalesce((v_item->>'unit_price')::bigint, 0);
    v_line := round(v_qty * v_price)::bigint;
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
-- update_document : intermédiaires de calcul en bigint
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
  v_subtotal bigint := 0;
  v_discount bigint;
  v_net bigint;
  v_vat_rate numeric(5, 2);
  v_vat_amount bigint;
  v_total bigint;
  v_advance bigint;
  v_doc public.documents%rowtype;
  v_pos integer := 0;
  v_qty numeric(12, 2);
  v_price bigint;
  v_line bigint;
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
    v_price := coalesce((v_item->>'unit_price')::bigint, 0);
    v_subtotal := v_subtotal + round(v_qty * v_price)::bigint;
  end loop;

  v_discount := least(greatest(coalesce((p_payload->>'discount')::bigint, 0), 0), v_subtotal);
  v_net := v_subtotal - v_discount;
  v_vat_rate := case when v_company.vat_enabled then v_company.vat_rate else 0 end;
  v_vat_amount := round(v_net * v_vat_rate / 100)::bigint;
  v_total := v_net + v_vat_amount;
  v_advance := least(greatest(coalesce((p_payload->>'advance_amount')::bigint, 0), 0), v_total);

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
    v_price := coalesce((v_item->>'unit_price')::bigint, 0);
    v_line := round(v_qty * v_price)::bigint;
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

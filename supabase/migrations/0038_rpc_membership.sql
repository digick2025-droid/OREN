-- ============================================================
-- 0038 : OREN ENTREPRISE — Phase 1 (RPC appartenance/rôle + équipe)
--
-- Les RPC métier vérifiaient encore owner_id = auth.uid() en dur
-- (0009/0016/0027) : un membre non-propriétaire était bloqué. On
-- passe au contrôle d'APPARTENANCE via user_company_ids() (réécrite
-- en 0037), en gardant le corps à l'identique par ailleurs.
-- Action sensible = facturation : change_plan réservé au gérant.
--
-- Puis les 4 RPC de gestion d'équipe (SECURITY DEFINER, révoquées de
-- anon/public — cf. [[supabase-revoke-from-public]]).
-- ============================================================

-- ------------------------------------------------------------
-- get_usage : garde owner → appartenance. Corps identique à 0009.
-- ------------------------------------------------------------
create or replace function public.get_usage(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_used integer;
  v_plan public.plans%rowtype;
  v_sub public.subscriptions%rowtype;
begin
  if p_company_id not in (select public.user_company_ids()) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_sub from public.subscriptions
  where company_id = p_company_id and status = 'active' and deleted_at is null
  limit 1;

  select * into v_plan from public.plans where key = coalesce(v_sub.plan_key, 'free');

  select count(*) into v_used from public.documents
  where company_id = p_company_id
    and (v_plan.quota_lifetime or created_at >= date_trunc('month', now()));

  return jsonb_build_object(
    'used', v_used,
    'quota', v_plan.monthly_quota,
    'plan_key', v_plan.key,
    'plan_name', v_plan.name,
    'features', coalesce(v_plan.features, '[]'::jsonb),
    'quota_lifetime', v_plan.quota_lifetime,
    'period_end', v_sub.current_period_end
  );
end;
$$;
revoke execute on function public.get_usage(uuid) from anon, public;
grant execute on function public.get_usage(uuid) to authenticated;

-- ------------------------------------------------------------
-- create_document : garde owner → appartenance (tout membre actif).
-- Corps identique à 0027, seul le garde + le chargement de v_company
-- changent (plus de filtre owner_id).
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
  v_category text;
begin
  if p_company_id not in (select public.user_company_ids()) then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_company from public.companies
  where id = p_company_id and deleted_at is null;
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
    v_category := coalesce(nullif(v_item->>'category', ''), 'article');
    if v_category not in ('article', 'main_oeuvre', 'transport') then
      v_category := 'article';
    end if;
    insert into public.document_items (document_id, position, name, unit, category, quantity, unit_price, line_total)
    values (v_doc.id, v_pos, coalesce(v_item->>'name', '—'),
            coalesce(v_item->>'unit', 'unité'), v_category, v_qty, v_price, v_line);
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
-- update_document : garde owner → appartenance. Corps identique à 0027.
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
  v_category text;
begin
  select d.* into v_existing
  from public.documents d
  join public.companies c on c.id = d.company_id
  where d.id = p_document_id
    and c.id in (select public.user_company_ids())
    and d.deleted_at is null;
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
    v_category := coalesce(nullif(v_item->>'category', ''), 'article');
    if v_category not in ('article', 'main_oeuvre', 'transport') then
      v_category := 'article';
    end if;
    insert into public.document_items (document_id, position, name, unit, category, quantity, unit_price, line_total)
    values (p_document_id, v_pos, coalesce(v_item->>'name', '—'),
            coalesce(v_item->>'unit', 'unité'), v_category, v_qty, v_price, v_line);
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
-- convert_document_to_invoice : garde owner → appartenance. Corps 0027.
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
    and c.id in (select public.user_company_ids())
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

  insert into public.document_items (document_id, position, name, unit, category, quantity, unit_price, line_total)
  select v_new.id, position, name, unit, category, quantity, unit_price, line_total
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

-- ------------------------------------------------------------
-- change_plan : action sensible (facturation) → réservée au gérant.
-- Délègue toujours à apply_plan_change (0016).
-- ------------------------------------------------------------
create or replace function public.change_plan(p_company_id uuid, p_plan_key text)
returns public.subscriptions
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_company_role(p_company_id, array['gerant']) then
    raise exception 'FORBIDDEN';
  end if;

  return public.apply_plan_change(p_company_id, p_plan_key, auth.uid());
end;
$$;
revoke execute on function public.change_plan(uuid, text) from anon, public;
grant execute on function public.change_plan(uuid, text) to authenticated;

-- ============================================================
-- RPC de gestion d'équipe
-- ============================================================

-- ------------------------------------------------------------
-- invite_member : le gérant invite par téléphone (normalisé côté
-- app). Crée/réactive une invitation « pending » ; l'invité la
-- réclame via claim_invitations(). Rôle 'gerant' interdit (contrainte
-- company_invitations).
-- ------------------------------------------------------------
create or replace function public.invite_member(p_company_id uuid, p_phone text, p_role text)
returns public.company_invitations
language plpgsql
security definer set search_path = public
as $$
declare
  v_inv public.company_invitations%rowtype;
  v_phone text := nullif(trim(p_phone), '');
begin
  if not public.has_company_role(p_company_id, array['gerant']) then
    raise exception 'FORBIDDEN';
  end if;
  if v_phone is null then
    raise exception 'INVALID_PHONE';
  end if;
  if p_role not in ('dispatcheur', 'commercial', 'technicien', 'comptable') then
    raise exception 'INVALID_ROLE';
  end if;

  -- Une seule invitation pending par (entreprise, téléphone)
  update public.company_invitations
  set role = p_role, status = 'pending', invited_by = auth.uid(), updated_at = now()
  where company_id = p_company_id and phone = v_phone and status = 'pending'
  returning * into v_inv;

  if not found then
    insert into public.company_invitations (company_id, phone, role, invited_by)
    values (p_company_id, v_phone, p_role, auth.uid())
    returning * into v_inv;
  end if;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_company_id, auth.uid(), 'member.invited', 'invitation', v_inv.id,
          jsonb_build_object('phone', v_phone, 'role', p_role));

  return v_inv;
end;
$$;
revoke execute on function public.invite_member(uuid, text, text) from anon, public;
grant execute on function public.invite_member(uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- claim_invitations : l'utilisateur courant réclame les invitations
-- « pending » qui ciblent son téléphone (profiles.phone). Devient
-- membre actif ; l'invitation passe « accepted ». Renvoie le nombre
-- d'entreprises rejointes.
-- ------------------------------------------------------------
create or replace function public.claim_invitations()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_phone text;
  v_inv public.company_invitations%rowtype;
  v_count integer := 0;
begin
  select phone into v_phone from public.profiles where id = auth.uid();
  if v_phone is null then
    return 0;
  end if;

  for v_inv in
    select * from public.company_invitations
    where phone = v_phone and status = 'pending'
  loop
    insert into public.company_members (company_id, user_id, role, status)
    values (v_inv.company_id, auth.uid(), v_inv.role, 'active')
    on conflict (company_id, user_id) where deleted_at is null
    do update set role = excluded.role, status = 'active', deleted_at = null;

    update public.company_invitations set status = 'accepted', updated_at = now()
    where id = v_inv.id;

    insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
    values (v_inv.company_id, auth.uid(), 'member.joined', 'member', v_inv.id,
            jsonb_build_object('role', v_inv.role));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke execute on function public.claim_invitations() from anon, public;
grant execute on function public.claim_invitations() to authenticated;

-- ------------------------------------------------------------
-- set_member_role : le gérant change le rôle d'un membre. Le
-- propriétaire (companies.owner_id) n'est pas modifiable.
-- ------------------------------------------------------------
create or replace function public.set_member_role(p_company_id uuid, p_user_id uuid, p_role text)
returns public.company_members
language plpgsql
security definer set search_path = public
as $$
declare
  v_member public.company_members%rowtype;
begin
  if not public.has_company_role(p_company_id, array['gerant']) then
    raise exception 'FORBIDDEN';
  end if;
  if p_role not in ('gerant', 'dispatcheur', 'commercial', 'technicien', 'comptable') then
    raise exception 'INVALID_ROLE';
  end if;
  if exists (
    select 1 from public.companies where id = p_company_id and owner_id = p_user_id
  ) then
    raise exception 'CANNOT_MODIFY_OWNER';
  end if;

  update public.company_members
  set role = p_role, updated_at = now()
  where company_id = p_company_id and user_id = p_user_id and deleted_at is null
  returning * into v_member;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_company_id, auth.uid(), 'member.role_changed', 'member', v_member.id,
          jsonb_build_object('user_id', p_user_id, 'role', p_role));

  return v_member;
end;
$$;
revoke execute on function public.set_member_role(uuid, uuid, text) from anon, public;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- remove_member : le gérant retire un membre (soft delete). Le
-- propriétaire ne peut pas être retiré.
-- ------------------------------------------------------------
create or replace function public.remove_member(p_company_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_company_role(p_company_id, array['gerant']) then
    raise exception 'FORBIDDEN';
  end if;
  if exists (
    select 1 from public.companies where id = p_company_id and owner_id = p_user_id
  ) then
    raise exception 'CANNOT_REMOVE_OWNER';
  end if;

  update public.company_members
  set deleted_at = now(), status = 'suspended', updated_at = now()
  where company_id = p_company_id and user_id = p_user_id and deleted_at is null;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_company_id, auth.uid(), 'member.removed', 'member', p_user_id,
          jsonb_build_object('user_id', p_user_id));
end;
$$;
revoke execute on function public.remove_member(uuid, uuid) from anon, public;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- list_company_members : membres + nom/téléphone de profil. Passe par
-- une RPC car profiles n'est lisible que pour soi (profiles_select_own) :
-- un gérant ne pourrait pas lire le nom de ses collègues en direct.
-- ------------------------------------------------------------
create or replace function public.list_company_members(p_company_id uuid)
returns table (
  user_id uuid,
  role text,
  status text,
  full_name text,
  phone text,
  is_owner boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if p_company_id not in (select public.user_company_ids()) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select m.user_id, m.role, m.status, pr.full_name, pr.phone,
         (c.owner_id = m.user_id) as is_owner, m.created_at
  from public.company_members m
  join public.companies c on c.id = m.company_id
  left join public.profiles pr on pr.id = m.user_id
  where m.company_id = p_company_id and m.deleted_at is null
  order by (c.owner_id = m.user_id) desc, m.created_at;
end;
$$;
revoke execute on function public.list_company_members(uuid) from anon, public;
grant execute on function public.list_company_members(uuid) to authenticated;

-- ------------------------------------------------------------
-- list_my_invitations : invitations « pending » qui ciblent le
-- téléphone de l'utilisateur courant, avec le nom de l'entreprise.
-- RPC car l'invité n'est pas encore membre (ne peut pas lire companies).
-- ------------------------------------------------------------
create or replace function public.list_my_invitations()
returns table (
  id uuid,
  company_id uuid,
  company_name text,
  role text,
  created_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_phone text;
begin
  select phone into v_phone from public.profiles where id = auth.uid();
  if v_phone is null then
    return;
  end if;

  return query
  select i.id, i.company_id, c.name, i.role, i.created_at
  from public.company_invitations i
  join public.companies c on c.id = i.company_id
  where i.phone = v_phone and i.status = 'pending'
  order by i.created_at desc;
end;
$$;
revoke execute on function public.list_my_invitations() from anon, public;
grant execute on function public.list_my_invitations() to authenticated;

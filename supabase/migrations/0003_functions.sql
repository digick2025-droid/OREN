-- ============================================================
-- DIGICK Devis — Fonctions métier (RPC)
-- Numérotation atomique, quotas, création de document,
-- conversion devis → facture, changement d'offre.
-- ============================================================

-- Offre gratuite de bienvenue (3 documents offerts) — configurée
-- en base comme les autres offres, jamais codée en dur.
insert into public.plans (key, name, price_fcfa, monthly_quota, per_document_price_fcfa, sort_order) values
  ('free', 'DIGICK Gratuit', 0, 3, null, 0);

-- Toute nouvelle entreprise démarre avec l'offre gratuite
create or replace function public.handle_new_company()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.subscriptions (company_id, plan_key)
  values (new.id, 'free');
  return new;
end;
$$;

create trigger on_company_created
  after insert on public.companies
  for each row execute function public.handle_new_company();

-- ------------------------------------------------------------
-- Numéro suivant : DEV-001 / FAC-001, par entreprise et par type.
-- Compteur monotone : un numéro n'est jamais réutilisé.
-- ------------------------------------------------------------
create or replace function public.next_document_number(p_company_id uuid, p_type text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_counter integer;
begin
  insert into public.document_counters (company_id, doc_type, counter)
  values (p_company_id, p_type, 1)
  on conflict (company_id, doc_type)
  do update set counter = public.document_counters.counter + 1
  returning counter into v_counter;

  return (case when p_type = 'facture' then 'FAC-' else 'DEV-' end)
    || lpad(v_counter::text, 3, '0');
end;
$$;

-- ------------------------------------------------------------
-- Usage mensuel : documents créés ce mois-ci (les documents
-- supprimés comptent — le quota mesure la création).
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
  if not exists (
    select 1 from public.companies
    where id = p_company_id and owner_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_sub from public.subscriptions
  where company_id = p_company_id and status = 'active' and deleted_at is null
  limit 1;

  select * into v_plan from public.plans where key = coalesce(v_sub.plan_key, 'free');

  select count(*) into v_used from public.documents
  where company_id = p_company_id
    and created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'used', v_used,
    'quota', v_plan.monthly_quota,
    'plan_key', v_plan.key,
    'plan_name', v_plan.name,
    'period_end', v_sub.current_period_end
  );
end;
$$;

-- ------------------------------------------------------------
-- Vérification interne du quota (levée d'exception si dépassé)
-- ------------------------------------------------------------
create or replace function public.assert_quota(p_company_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_quota integer;
  v_used integer;
begin
  select p.monthly_quota into v_quota
  from public.subscriptions s
  join public.plans p on p.key = s.plan_key
  where s.company_id = p_company_id and s.status = 'active' and s.deleted_at is null
  limit 1;

  -- null = illimité ; pas d'abonnement actif = bloqué
  if not found then
    raise exception 'QUOTA_EXCEEDED';
  end if;
  if v_quota is null then
    return;
  end if;

  select count(*) into v_used from public.documents
  where company_id = p_company_id
    and created_at >= date_trunc('month', now());

  if v_used >= v_quota then
    raise exception 'QUOTA_EXCEEDED';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- Création d'un document (devis ou facture) avec ses lignes.
-- Les totaux sont recalculés côté base : source de vérité unique.
-- p_payload : { type, client_id, title, note, conditions, discount, items: [{name, unit, quantity, unit_price}] }
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
  if v_type not in ('devis', 'facture') then
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

  insert into public.documents (
    company_id, client_id, type, number, status, title, issue_date,
    client_name, client_phone,
    subtotal, discount, vat_enabled, vat_rate, vat_amount, total,
    note, conditions, converted_from
  ) values (
    p_company_id,
    v_client.id,
    v_type,
    public.next_document_number(p_company_id, v_type),
    'brouillon',
    coalesce(p_payload->>'title', ''),
    current_date,
    coalesce(v_client.name, coalesce(p_payload->>'client_name', '')),
    coalesce(v_client.phone, coalesce(p_payload->>'client_phone', '')),
    v_subtotal, v_discount,
    v_company.vat_enabled, v_vat_rate, v_vat_amount,
    v_net + v_vat_amount,
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

-- ------------------------------------------------------------
-- Conversion devis → facture (copie avec nouveau numéro FAC-)
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
  if v_src.type <> 'devis' then
    raise exception 'NOT_A_QUOTE';
  end if;

  perform public.assert_quota(v_src.company_id);

  insert into public.documents (
    company_id, client_id, type, number, status, title, issue_date,
    client_name, client_phone,
    subtotal, discount, vat_enabled, vat_rate, vat_amount, total,
    note, conditions, converted_from
  ) values (
    v_src.company_id, v_src.client_id, 'facture',
    public.next_document_number(v_src.company_id, 'facture'),
    'brouillon', v_src.title, current_date,
    v_src.client_name, v_src.client_phone,
    v_src.subtotal, v_src.discount, v_src.vat_enabled, v_src.vat_rate,
    v_src.vat_amount, v_src.total,
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

-- ------------------------------------------------------------
-- Changement d'offre (appelé par l'API après paiement confirmé)
-- ------------------------------------------------------------
create or replace function public.change_plan(p_company_id uuid, p_plan_key text)
returns public.subscriptions
language plpgsql
security definer set search_path = public
as $$
declare
  v_sub public.subscriptions%rowtype;
begin
  if not exists (
    select 1 from public.companies
    where id = p_company_id and owner_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.plans where key = p_plan_key and is_active = true
  ) then
    raise exception 'INVALID_PLAN';
  end if;

  update public.subscriptions
  set status = 'canceled', deleted_at = now()
  where company_id = p_company_id and status = 'active' and deleted_at is null;

  insert into public.subscriptions (company_id, plan_key, current_period_start, current_period_end)
  values (p_company_id, p_plan_key, now(), now() + interval '1 month')
  returning * into v_sub;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_company_id, auth.uid(), 'subscription.changed', 'subscription', v_sub.id,
          jsonb_build_object('plan', p_plan_key));

  return v_sub;
end;
$$;

-- ============================================================
-- 0018 : codes promo, applicables uniquement au parcours
-- abonnement (pas à Express, paiement anonyme sans session).
-- ============================================================

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default '',
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric not null,
  applicable_plans text[],
  max_redemptions integer,
  redemption_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  batch_id uuid,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (discount_type = 'percent' and discount_value > 0 and discount_value <= 100)
    or (discount_type = 'fixed' and discount_value > 0)
  )
);

create trigger promo_codes_updated_at
  before update on public.promo_codes
  for each row execute function public.set_updated_at();

create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  payment_intent_id uuid references public.payment_intents (id) on delete set null,
  discount_fcfa integer not null,
  created_at timestamptz not null default now(),
  unique (promo_code_id, company_id)
);

alter table public.payment_intents
  add column promo_code_id uuid references public.promo_codes (id),
  add column discount_fcfa integer not null default 0;

alter table public.promo_codes enable row level security;
create policy "promo_codes_admin_all" on public.promo_codes
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.promo_redemptions enable row level security;
create policy "promo_redemptions_admin_all" on public.promo_redemptions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "promo_redemptions_select_own" on public.promo_redemptions
  for select using (company_id in (select public.user_company_ids()));

-- ------------------------------------------------------------
-- preview_promo_code : validation + calcul de réduction, sans
-- effet de bord. Utilisée deux fois : par le formulaire de
-- paiement (aperçu instantané) et par /api/payments (calcul
-- authoritatif du montant envoyé à la passerelle) — une seule
-- implémentation SQL, pas de logique dupliquée côté TypeScript.
-- ------------------------------------------------------------
create or replace function public.preview_promo_code(p_code text, p_plan_key text)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_promo public.promo_codes%rowtype;
  v_plan public.plans%rowtype;
  v_company_id uuid;
  v_discount integer;
begin
  select * into v_plan from public.plans where key = p_plan_key and is_active = true;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'INVALID_PLAN');
  end if;

  if v_code = '' then
    return jsonb_build_object('valid', false, 'reason', 'EMPTY');
  end if;

  select * into v_promo from public.promo_codes where code = v_code;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'NOT_FOUND');
  end if;

  if not v_promo.is_active then
    return jsonb_build_object('valid', false, 'reason', 'INACTIVE');
  end if;
  if v_promo.starts_at is not null and v_promo.starts_at > now() then
    return jsonb_build_object('valid', false, 'reason', 'NOT_STARTED');
  end if;
  if v_promo.expires_at is not null and v_promo.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'EXPIRED');
  end if;
  if v_promo.applicable_plans is not null and not (p_plan_key = any (v_promo.applicable_plans)) then
    return jsonb_build_object('valid', false, 'reason', 'PLAN_NOT_ELIGIBLE');
  end if;
  if v_promo.max_redemptions is not null and v_promo.redemption_count >= v_promo.max_redemptions then
    return jsonb_build_object('valid', false, 'reason', 'LIMIT_REACHED');
  end if;

  select id into v_company_id from public.companies
  where owner_id = auth.uid() and deleted_at is null;

  if v_company_id is not null and exists (
    select 1 from public.promo_redemptions
    where promo_code_id = v_promo.id and company_id = v_company_id
  ) then
    return jsonb_build_object('valid', false, 'reason', 'ALREADY_USED');
  end if;

  if v_promo.discount_type = 'percent' then
    v_discount := floor(v_plan.price_fcfa * v_promo.discount_value / 100);
  else
    v_discount := v_promo.discount_value::integer;
  end if;
  v_discount := least(v_discount, v_plan.price_fcfa);

  return jsonb_build_object(
    'valid', true,
    'reason', null,
    'promo_code_id', v_promo.id,
    'discount_fcfa', v_discount,
    'final_amount_fcfa', greatest(v_plan.price_fcfa - v_discount, 0)
  );
end;
$$;

revoke execute on function public.preview_promo_code(text, text) from anon, public;
grant execute on function public.preview_promo_code(text, text) to authenticated;

-- ------------------------------------------------------------
-- admin_bulk_create_promo_codes : génère un lot de codes à usage
-- unique (campagne, événement). L'export CSV se fait ensuite
-- côté client à partir du résultat, sans backend dédié.
-- ------------------------------------------------------------
create or replace function public.admin_bulk_create_promo_codes(
  p_prefix text,
  p_count integer,
  p_discount_type text,
  p_discount_value numeric,
  p_applicable_plans text[],
  p_expires_at timestamptz
)
returns setof public.promo_codes
language plpgsql
security definer set search_path = public
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_code text;
  i integer;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_count is null or p_count < 1 or p_count > 500 then
    raise exception 'INVALID_COUNT';
  end if;
  if p_discount_type not in ('percent', 'fixed') then
    raise exception 'INVALID_DISCOUNT_TYPE';
  end if;

  for i in 1..p_count loop
    loop
      v_code := upper(coalesce(nullif(trim(p_prefix), ''), 'PROMO')) || '-'
        || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
      exit when not exists (select 1 from public.promo_codes where code = v_code);
    end loop;

    insert into public.promo_codes (
      code, discount_type, discount_value, applicable_plans,
      max_redemptions, expires_at, batch_id, created_by
    ) values (
      v_code, p_discount_type, p_discount_value, p_applicable_plans,
      1, p_expires_at, v_batch_id, auth.uid()
    );
  end loop;

  return query select * from public.promo_codes where batch_id = v_batch_id order by code;
end;
$$;

revoke execute on function public.admin_bulk_create_promo_codes(text, integer, text, numeric, text[], timestamptz)
  from anon, public;
grant execute on function public.admin_bulk_create_promo_codes(text, integer, text, numeric, text[], timestamptz)
  to authenticated;

-- ------------------------------------------------------------
-- settle_payment_intent (0016) redéfinie : au règlement réussi,
-- si un code promo était attaché, enregistre la rédemption et
-- incrémente le compteur. on conflict do nothing = rejoue-sûr,
-- même philosophie idempotente que le reste de la fonction.
-- ------------------------------------------------------------
create or replace function public.settle_payment_intent(
  p_reference text,
  p_status text,
  p_provider_reference text
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_payment_id uuid;
begin
  if p_status not in ('succeeded', 'failed', 'pending') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into v_intent
  from public.payment_intents
  where reference = p_reference
  for update;

  if not found then
    raise exception 'INTENT_NOT_FOUND';
  end if;

  if v_intent.status <> 'pending' then
    return v_intent.status;
  end if;

  if p_status = 'pending' then
    update public.payment_intents
    set provider_reference = coalesce(nullif(p_provider_reference, ''), provider_reference)
    where id = v_intent.id;
    return 'pending';
  end if;

  if p_status = 'failed' then
    update public.payment_intents
    set status = 'failed',
        settled_at = now(),
        provider_reference = coalesce(nullif(p_provider_reference, ''), provider_reference)
    where id = v_intent.id;
    return 'failed';
  end if;

  -- ---- Succès ----
  insert into public.payments (
    company_id, amount, currency, provider, method, status, reference, phone
  ) values (
    v_intent.company_id,
    v_intent.amount,
    v_intent.currency,
    v_intent.provider,
    v_intent.method,
    'succeeded',
    coalesce(nullif(p_provider_reference, ''), v_intent.reference),
    v_intent.phone
  )
  returning id into v_payment_id;

  update public.payment_intents
  set status = 'succeeded',
      settled_at = now(),
      payment_id = v_payment_id,
      provider_reference = coalesce(nullif(p_provider_reference, ''), provider_reference)
  where id = v_intent.id;

  if v_intent.promo_code_id is not null and v_intent.company_id is not null then
    insert into public.promo_redemptions (promo_code_id, company_id, payment_intent_id, discount_fcfa)
    values (v_intent.promo_code_id, v_intent.company_id, v_intent.id, v_intent.discount_fcfa)
    on conflict (promo_code_id, company_id) do nothing;

    update public.promo_codes
    set redemption_count = redemption_count + 1
    where id = v_intent.promo_code_id;
  end if;

  if v_intent.purpose = 'subscription'
     and v_intent.company_id is not null
     and v_intent.plan_key is not null then
    perform public.apply_plan_change(v_intent.company_id, v_intent.plan_key, null);
  end if;

  return 'succeeded';
end;
$$;

revoke execute on function public.settle_payment_intent(text, text, text)
  from anon, authenticated, public;

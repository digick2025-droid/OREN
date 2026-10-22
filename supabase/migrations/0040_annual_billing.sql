-- ============================================================
-- 0040 : abonnement annuel — 12 mois pour le prix de 10.
--
-- Le prix annuel n'est pas stocké : il vaut toujours 10 × le prix mensuel
-- de l'offre (src/lib/pricing.ts, annualPrice), calculé côté serveur dans
-- /api/payments. Une seule source de prix, rien à désynchroniser.
--
-- Le quota reste mensuel (assert_quota compte par mois calendaire) : un
-- abonné annuel Pro a toujours 25 documents chaque mois.
-- ============================================================

alter table public.payment_intents
  add column if not exists billing_months integer not null default 1
    check (billing_months in (1, 12));

-- ------------------------------------------------------------
-- apply_plan_change : durée paramétrable (1 ou 12 mois).
--
-- Renouveler la MÊME offre avant son échéance prolonge la période en
-- cours au lieu de la redémarrer : les jours déjà payés ne sont pas perdus
-- (un mensuel qui passe à l'annuel garde son mois entamé).
-- ------------------------------------------------------------
drop function if exists public.apply_plan_change(uuid, text, uuid);

create or replace function public.apply_plan_change(
  p_company_id uuid,
  p_plan_key text,
  p_actor uuid,
  p_months integer default 1
)
returns public.subscriptions
language plpgsql
security definer set search_path = public
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_current_end timestamptz;
  v_months integer := greatest(1, coalesce(p_months, 1));
begin
  if not exists (
    select 1 from public.plans where key = p_plan_key and is_active = true
  ) then
    raise exception 'INVALID_PLAN';
  end if;

  select current_period_end into v_current_end
  from public.subscriptions
  where company_id = p_company_id and status = 'active' and deleted_at is null
    and plan_key = p_plan_key
  limit 1;

  update public.subscriptions
  set status = 'canceled', deleted_at = now()
  where company_id = p_company_id and status = 'active' and deleted_at is null;

  insert into public.subscriptions (company_id, plan_key, current_period_start, current_period_end)
  values (
    p_company_id,
    p_plan_key,
    now(),
    greatest(now(), coalesce(v_current_end, now())) + make_interval(months => v_months)
  )
  returning * into v_sub;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_company_id, p_actor, 'subscription.changed', 'subscription', v_sub.id,
          jsonb_build_object('plan', p_plan_key, 'months', v_months));

  return v_sub;
end;
$$;

revoke execute on function public.apply_plan_change(uuid, text, uuid, integer)
  from anon, authenticated, public;

-- ------------------------------------------------------------
-- settle_payment_intent : corps de la 0037, avec la durée payée.
-- ------------------------------------------------------------
create or replace function public.settle_payment_intent(
  p_reference text,
  p_status text,
  p_provider_reference text,
  p_failure_reason text default null,
  p_failure_code text default null
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
        provider_reference = coalesce(nullif(p_provider_reference, ''), provider_reference),
        failure_reason = nullif(p_failure_reason, ''),
        failure_code = nullif(p_failure_code, '')
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
    perform public.apply_plan_change(
      v_intent.company_id, v_intent.plan_key, null, coalesce(v_intent.billing_months, 1)
    );
  end if;

  -- Documents achetés à l'unité : crédités maintenant, jamais à l'initiation.
  if v_intent.purpose = 'document_credit'
     and v_intent.company_id is not null
     and v_intent.credits > 0 then
    update public.company_credits
    set document_credits = document_credits + v_intent.credits
    where company_id = v_intent.company_id;
  end if;

  return 'succeeded';
end;
$$;

revoke execute on function
  public.settle_payment_intent(text, text, text, text, text)
  from anon, authenticated, public;

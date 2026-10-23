-- ============================================================
-- 0042 : offres simplifiées — Gratuit et Pro, Pro payable à la semaine.
--
-- Terrain : l'artisan règle un besoin (« un devis à envoyer »), au rythme
-- de sa trésorerie, et compare mal quatre cartes sur un petit écran. On
-- passe donc à deux offres :
--   - Gratuit : 5 documents PAR MOIS (et non plus 3 à vie) ;
--   - Pro     : documents illimités, logo — 950 F la semaine, 2 900 F le
--               mois, 29 000 F l'année (10 × le mois, src/lib/pricing.ts).
-- Business disparaît : tout ce qu'il contenait passe dans Pro, et ses
-- abonnés actifs basculent en Pro sans perdre leur période en cours.
--
-- La semaine n'est pas une offre de plus mais une durée de Pro : le prix
-- est porté par `plans.week_price_fcfa`, la durée payée par
-- `payment_intents.billing_days`.
--
-- Corrige au passage une faille : `change_plan` est appelable depuis le
-- navigateur et appliquait n'importe quelle offre sans paiement. Il est
-- désormais réservé aux offres gratuites.
-- ============================================================

alter table public.plans
  add column if not exists week_price_fcfa integer
    check (week_price_fcfa is null or week_price_fcfa > 0);

comment on column public.plans.week_price_fcfa is
  'Prix pour 7 jours (null = offre non vendue à la semaine).';

alter table public.payment_intents
  add column if not exists billing_days integer
    check (billing_days is null or billing_days between 1 and 31);

comment on column public.payment_intents.billing_days is
  'Durée payée en jours (paiement à la semaine) ; null = billing_months fait foi.';

-- ------------------------------------------------------------
-- Gratuit : 5 documents par mois.
-- En mode « tout gratuit » (0036), le quota réel est dans le snapshot :
-- c'est lui qu'on change, pour que restore_plan_prices le remette.
-- ------------------------------------------------------------
update public.plans
set quota_lifetime = false,
    monthly_quota = case when promo_quota_snapshotted then monthly_quota else 5 end,
    promo_quota_snapshot = case when promo_quota_snapshotted then 5 else promo_quota_snapshot end,
    marketing = jsonb_build_object(
      'fr', jsonb_build_object(
        'tag', '5 documents chaque mois, pour toujours',
        'audience', 'Pour démarrer',
        'features', jsonb_build_array(
          '5 devis ou factures par mois', 'PDF professionnel', 'Envoi WhatsApp', 'Sans carte bancaire'
        )
      ),
      'en', jsonb_build_object(
        'tag', '5 documents every month, forever',
        'audience', 'To get started',
        'features', jsonb_build_array(
          '5 quotes or invoices a month', 'Professional PDF', 'WhatsApp sharing', 'No credit card'
        )
      )
    )
where key = 'free';

-- ------------------------------------------------------------
-- Pro : illimité, toutes les fonctions, payable à la semaine.
-- Même logique de snapshot pour le quota (illimité dans les deux cas).
-- ------------------------------------------------------------
update public.plans
set monthly_quota = null,
    promo_quota_snapshot = case when promo_quota_snapshotted then null else promo_quota_snapshot end,
    week_price_fcfa = coalesce(week_price_fcfa, 950),
    features = '["catalog", "reports", "proforma", "logo", "advance"]'::jsonb,
    marketing = jsonb_build_object(
      'fr', jsonb_build_object(
        'tag', 'Tout OREN, sans limite',
        'audience', 'Pour l''artisan qui travaille',
        'features', jsonb_build_array(
          'Devis et factures illimités', 'Votre logo sur chaque document',
          'Sans mention OREN', 'Acomptes, catalogue et rapports'
        )
      ),
      'en', jsonb_build_object(
        'tag', 'All of OREN, no limits',
        'audience', 'For working tradespeople',
        'features', jsonb_build_array(
          'Unlimited quotes and invoices', 'Your logo on every document',
          'No OREN mention', 'Deposits, catalog and reports'
        )
      )
    )
where key = 'pro';

-- ------------------------------------------------------------
-- Business : abonnés actifs basculés en Pro, période conservée.
-- L'offre reste en base (historique, clés étrangères) mais n'est plus
-- vendue.
-- ------------------------------------------------------------
with moved as (
  update public.subscriptions
  set plan_key = 'pro'
  where plan_key = 'business' and status = 'active' and deleted_at is null
  returning id, company_id
)
insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
select company_id, null, 'subscription.changed', 'subscription', id,
       jsonb_build_object('plan', 'pro', 'from', 'business', 'reason', 'offres_simplifiees')
from moved;

update public.plans set is_active = false where key = 'business';

-- ------------------------------------------------------------
-- apply_plan_change : corps de la 0040, durée en jours possible.
-- L'ancienne signature est supprimée : la garder rendrait ambigus les
-- appels à 3 ou 4 arguments.
-- ------------------------------------------------------------
drop function if exists public.apply_plan_change(uuid, text, uuid, integer);

create or replace function public.apply_plan_change(
  p_company_id uuid,
  p_plan_key text,
  p_actor uuid,
  p_months integer default 1,
  p_days integer default null
)
returns public.subscriptions
language plpgsql
security definer set search_path = public
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_current_end timestamptz;
  v_months integer := greatest(1, coalesce(p_months, 1));
  v_duration interval;
begin
  if not exists (
    select 1 from public.plans where key = p_plan_key and is_active = true
  ) then
    raise exception 'INVALID_PLAN';
  end if;

  v_duration := case
    when p_days is not null and p_days > 0 then make_interval(days => p_days)
    else make_interval(months => v_months)
  end;

  -- Renouveler la MÊME offre avant échéance prolonge la période en cours
  -- (une semaine prise en cours de mois s'ajoute à ce qui reste).
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
    greatest(now(), coalesce(v_current_end, now())) + v_duration
  )
  returning * into v_sub;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_company_id, p_actor, 'subscription.changed', 'subscription', v_sub.id,
          jsonb_build_object('plan', p_plan_key, 'months', v_months, 'days', p_days));

  return v_sub;
end;
$$;

revoke execute on function public.apply_plan_change(uuid, text, uuid, integer, integer)
  from anon, authenticated, public;

-- ------------------------------------------------------------
-- change_plan : réservé aux offres gratuites. Une offre payante ne
-- s'applique que par settle_payment_intent, une fois le paiement réglé.
-- ------------------------------------------------------------
create or replace function public.change_plan(p_company_id uuid, p_plan_key text)
returns public.subscriptions
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.companies
    where id = p_company_id and owner_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.plans
    where key = p_plan_key
      and price_fcfa = 0
      and coalesce(per_document_price_fcfa, 0) = 0
  ) then
    raise exception 'PAYMENT_REQUIRED';
  end if;

  return public.apply_plan_change(p_company_id, p_plan_key, auth.uid());
end;
$$;
revoke execute on function public.change_plan(uuid, text) from anon, public;
grant execute on function public.change_plan(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- settle_payment_intent : corps de la 0041, avec la durée en jours.
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
      v_intent.company_id, v_intent.plan_key, null,
      coalesce(v_intent.billing_months, 1), v_intent.billing_days
    );

    -- Parrain : récompensé au premier abonnement payé du filleul. Paiement
    -- manuel : seulement après vérification par l'admin (voir
    -- admin_review_manual_payment), pour qu'une fausse référence ne
    -- rapporte rien.
    if v_intent.provider <> 'manual' then
      perform public.reward_referrer_on_payment(v_intent.id);
    end if;
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

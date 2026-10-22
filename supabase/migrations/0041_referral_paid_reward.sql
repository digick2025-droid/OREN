-- ============================================================
-- 0041 : le parrain gagne 1 mois d'abonnement quand son filleul s'abonne.
--
-- S'ajoute au document offert au premier envoi du filleul (0037).
--   - Parrain déjà abonné (offre payante) : son offre est prolongée d'un
--     mois (apply_plan_change prolonge la période en cours, 0040).
--   - Parrain en gratuit : 1 mois de Pro offert, qui expire ensuite
--     normalement (expire_overdue_subscriptions).
-- Une seule fois par filleul (referral_paid_rewarded_at), au premier
-- abonnement payé. Paiement manuel : après vérification par l'admin.
-- Une récompense qui échoue ne bloque jamais le paiement du filleul.
-- ============================================================

alter table public.company_credits
  add column if not exists referral_paid_rewarded_at timestamptz;

create or replace function public.reward_referrer_on_payment(p_intent_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_referrer uuid;
  v_plan text;
begin
  select * into v_intent from public.payment_intents where id = p_intent_id;
  if not found
     or v_intent.purpose <> 'subscription'
     or v_intent.status <> 'succeeded'
     or v_intent.company_id is null
     or v_intent.amount <= 0 then
    return;
  end if;

  update public.company_credits
  set referral_paid_rewarded_at = now()
  where company_id = v_intent.company_id
    and referred_by is not null
    and referral_paid_rewarded_at is null
  returning referred_by into v_referrer;

  if v_referrer is null then
    return;
  end if;

  begin
    select s.plan_key into v_plan
    from public.subscriptions s
    join public.plans p on p.key = s.plan_key
    where s.company_id = v_referrer and s.status = 'active' and s.deleted_at is null
      and s.plan_key <> 'free' and p.price_fcfa > 0
    limit 1;

    perform public.apply_plan_change(v_referrer, coalesce(v_plan, 'pro'), null, 1);

    insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
    values (v_referrer, null, 'referral.paid_rewarded', 'company', v_intent.company_id,
            jsonb_build_object('referee', v_intent.company_id, 'plan', coalesce(v_plan, 'pro')));
  exception when others then
    -- Offre Pro désactivée, parrain supprimé… : le paiement du filleul
    -- passe quand même ; la récompense reste due et se rejoue à la main.
    update public.company_credits
    set referral_paid_rewarded_at = null
    where company_id = v_intent.company_id;
    raise warning 'reward_referrer_on_payment(%) : %', p_intent_id, sqlerrm;
  end;
end;
$$;
revoke execute on function public.reward_referrer_on_payment(uuid) from anon, authenticated, public;

-- ------------------------------------------------------------
-- settle_payment_intent : corps de la 0040, plus la récompense du parrain.
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

-- ------------------------------------------------------------
-- admin_review_manual_payment : corps de la 0039, plus la récompense du
-- parrain à la confirmation.
-- ------------------------------------------------------------
create or replace function public.admin_review_manual_payment(
  p_reference text,
  p_decision text,
  p_reason text default null
)
returns text
language plpgsql
volatile
security definer set search_path = public
as $$
declare
  v_intent public.payment_intents%rowtype;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if p_decision not in ('confirmed', 'rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  select * into v_intent
  from public.payment_intents
  where reference = p_reference
  for update;

  if not found then
    raise exception 'INTENT_NOT_FOUND';
  end if;

  if v_intent.provider <> 'manual' then
    raise exception 'NOT_MANUAL';
  end if;

  -- Décision déjà prise : on ne rejoue rien (idempotent).
  if v_intent.review_status is distinct from 'to_review' then
    return coalesce(v_intent.review_status, v_intent.status);
  end if;

  if p_decision = 'confirmed' then
    update public.payment_intents
    set review_status = 'confirmed', reviewed_at = now(), reviewed_by = auth.uid()
    where id = v_intent.id;
    -- Paiement vérifié : le parrain peut maintenant être récompensé.
    perform public.reward_referrer_on_payment(v_intent.id);
    return 'confirmed';
  end if;

  -- ---- Annulation : fausse référence ----
  update public.payment_intents
  set review_status = 'rejected',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      status = 'failed',
      failure_reason = coalesce(nullif(p_reason, ''), 'Référence de paiement non retrouvée'),
      failure_code = 'MANUAL_REJECTED'
  where id = v_intent.id;

  if v_intent.payment_id is not null then
    update public.payments set status = 'failed' where id = v_intent.payment_id;
  end if;

  -- Abonnement : retour en gratuit, seulement si l'offre active est bien
  -- celle achetée par ce paiement (un changement ultérieur n'est pas touché).
  if v_intent.purpose = 'subscription'
     and v_intent.company_id is not null
     and exists (
       select 1 from public.subscriptions
       where company_id = v_intent.company_id
         and status = 'active' and deleted_at is null
         and plan_key = v_intent.plan_key
     ) then
    perform public.apply_plan_change(v_intent.company_id, 'free', auth.uid());
  end if;

  -- Documents achetés : retirés, sans jamais passer sous zéro (ceux déjà
  -- consommés ne peuvent pas être repris).
  if v_intent.purpose = 'document_credit'
     and v_intent.company_id is not null
     and v_intent.credits > 0 then
    update public.company_credits
    set document_credits = greatest(0, document_credits - v_intent.credits)
    where company_id = v_intent.company_id;
  end if;

  -- Express : document déjà téléchargé, rien à reprendre ; l'annulation
  -- reste tracée sur l'intention.
  return 'rejected';
end;
$$;

revoke execute on function public.admin_review_manual_payment(text, text, text) from anon, public;
grant execute on function public.admin_review_manual_payment(text, text, text) to authenticated;

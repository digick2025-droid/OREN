-- ============================================================
-- 0039 : paiement manuel Mobile Money + suivi du paiement.
--
-- Les passerelles échouent (voir src/lib/billing.ts). En attendant, le
-- client envoie l'argent lui-même au numéro marchand, puis saisit la
-- référence de la transaction reçue par SMS.
--
-- Choix produit : ce qui est payé est débloqué TOUT DE SUITE (le parcours
-- ne s'arrête jamais pour attendre un humain). L'admin contrôle ensuite la
-- référence et annule une fausse déclaration : l'abonnement repasse en
-- gratuit, les documents achetés sont retirés.
--
-- Garde-fou : une même référence SMS ne débloque qu'une seule fois.
-- ============================================================

alter table public.payment_intents
  add column if not exists transaction_ref text,
  add column if not exists review_status text
    check (review_status in ('to_review', 'confirmed', 'rejected')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

-- Une référence ne sert qu'une fois, même si sa première utilisation a
-- été annulée : une fausse référence ne doit pas pouvoir être rejouée.
create unique index if not exists payment_intents_transaction_ref_key
  on public.payment_intents (transaction_ref)
  where transaction_ref is not null;

create index if not exists payment_intents_to_review_idx
  on public.payment_intents (created_at desc)
  where review_status = 'to_review';

-- ------------------------------------------------------------
-- admin_review_manual_payment : confirmer ou annuler un paiement manuel.
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

-- ------------------------------------------------------------
-- track_event (0038) : ajoute les étapes du paiement.
-- ------------------------------------------------------------
create or replace function public.track_event(
  p_event text,
  p_anon_id uuid,
  p_props jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer set search_path = public
as $$
begin
  if p_event not in (
    'landing_view',
    'signup_view',
    'signup_completed',
    'builder_opened',
    'quota_blocked',
    'document_generated',
    'document_shared',
    'express_started',
    'express_preview',
    'express_done',
    'express_to_signup',
    'paywall_view',
    'payment_started',
    'payment_succeeded',
    'payment_failed'
  ) then
    return;
  end if;

  if p_anon_id is null then
    return;
  end if;

  if p_props is null or jsonb_typeof(p_props) <> 'object'
     or pg_column_size(p_props) > 2048 then
    p_props := '{}'::jsonb;
  end if;

  insert into public.funnel_events (event, anon_id, user_id, props)
  values (p_event, p_anon_id, auth.uid(), p_props);
end;
$$;

revoke execute on function public.track_event(text, uuid, jsonb) from public;
grant execute on function public.track_event(text, uuid, jsonb) to anon, authenticated;

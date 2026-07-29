-- ------------------------------------------------------------
-- 0030 : motif d'échec d'un paiement + réconciliation active
--
-- Deux manques révélés par des intentions restées « pending » indéfiniment
-- en production, sans qu'on puisse dire pourquoi :
--
--   1. Quand un paiement échoue, CamerPay envoie depuis juillet 2026
--      `failure_reason` (« Solde du compte du payeur insuffisant », « PIN
--      incorrect »…) et `failure_code` (60019, USER_CANCELED_PAYMENT…).
--      On les jetait : ni le client ni l'admin ne savaient quoi refaire.
--   2. Le règlement ne pouvait venir QUE du webhook. Un callback perdu
--      laissait une intention en attente pour toujours — alors même que
--      l'argent avait quitté le compte du client. `/api/payments/status`
--      interroge désormais la passerelle et règle via cette même fonction :
--      d'où le besoin de tracer ce motif quel que soit le chemin.
--
-- `settle_payment_intent` reste l'UNIQUE chemin de règlement, et reste
-- idempotent. On la recrée (drop + create) au lieu d'ajouter une surcharge :
-- deux signatures cohabitantes rendraient l'appel RPC ambigu.
--
-- ⚠️ Corps repris de la version 0018 (celle qui enregistre la rédemption du
-- code promo), PAS de la 0016 : la recréer depuis la 0016 réintroduirait des
-- promos jamais décomptées.
-- ------------------------------------------------------------

alter table public.payment_intents
  add column if not exists failure_reason text,
  add column if not exists failure_code text;

comment on column public.payment_intents.failure_reason is
  'Motif d''échec lisible renvoyé par la passerelle (non signé : informatif).';
comment on column public.payment_intents.failure_code is
  'Code technique d''échec provider/passerelle (60019, USER_CANCELED_PAYMENT…).';

drop function if exists public.settle_payment_intent(text, text, text);

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

  -- Déjà tranchée : on ne rejoue rien, on renvoie l'état acquis.
  if v_intent.status <> 'pending' then
    return v_intent.status;
  end if;

  -- Un webhook « pending » (accusé de réception) ne tranche rien : on se
  -- contente d'enregistrer la référence passerelle si elle arrive ici.
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

  -- Rédemption du code promo (0018) : `on conflict do nothing` = rejeu-sûr.
  if v_intent.promo_code_id is not null and v_intent.company_id is not null then
    insert into public.promo_redemptions (promo_code_id, company_id, payment_intent_id, discount_fcfa)
    values (v_intent.promo_code_id, v_intent.company_id, v_intent.id, v_intent.discount_fcfa)
    on conflict (promo_code_id, company_id) do nothing;

    update public.promo_codes
    set redemption_count = redemption_count + 1
    where id = v_intent.promo_code_id;
  end if;

  -- Abonnement : l'offre n'est appliquée QUE maintenant, jamais à
  -- l'initiation. Le règlement (webhook ou réconciliation) fait foi.
  if v_intent.purpose = 'subscription'
     and v_intent.company_id is not null
     and v_intent.plan_key is not null then
    perform public.apply_plan_change(v_intent.company_id, v_intent.plan_key, null);
  end if;

  return 'succeeded';
end;
$$;

-- Réservée au service role : ni le navigateur, ni un utilisateur connecté
-- ne doivent pouvoir déclarer un paiement réussi.
revoke execute on function
  public.settle_payment_intent(text, text, text, text, text)
  from anon, authenticated, public;

-- ------------------------------------------------------------
-- 0016 : intentions de paiement + confirmation par webhook signé
--
-- Une vraie passerelle Mobile Money (CamerPay) ne règle rien de façon
-- synchrone : `/api/payments` initie la transaction, le client valide sur
-- son téléphone, puis la passerelle rappelle `/api/payments/webhook`.
-- Il faut donc une trace persistante entre les deux : `payment_intents`.
--
-- Contrat :
--   - `/api/payments` écrit l'intention (status 'pending') AVANT d'appeler
--     la passerelle, avec le service role (jamais le client).
--   - `settle_payment_intent()` est l'UNIQUE chemin qui insère dans
--     `payments` et applique le changement d'offre. Il est idempotent :
--     un webhook rejoué renvoie le statut déjà acquis sans rien rejouer.
--   - La table n'est jamais écrite depuis le navigateur : RLS en lecture
--     seule, et la fonction est réservée au service role.
-- ------------------------------------------------------------

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  -- Référence interne OREN (OREN-SUB-… / OREN-EXP-…) : corrèle init ⇆ webhook.
  -- L'unicité est ce qui rend la confirmation idempotente.
  reference text not null unique,
  provider text not null default 'simulated',
  -- Identifiant côté passerelle, connu seulement après l'initiation.
  provider_reference text not null default '',
  purpose text not null
    check (purpose in ('subscription', 'express_document')),
  -- null pour un document express (payeur anonyme, sans compte).
  company_id uuid references public.companies (id) on delete set null,
  plan_key text references public.plans (key),
  amount bigint not null check (amount >= 0),
  currency text not null default 'XAF',
  method text not null
    check (method in ('orange_money', 'mtn_momo', 'card')),
  phone text,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed')),
  -- Ligne `payments` créée au règlement (null tant que pending/failed).
  payment_id uuid references public.payments (id) on delete set null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_intents_company_idx
  on public.payment_intents (company_id, created_at desc);

create trigger payment_intents_updated_at
  before update on public.payment_intents
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS : lecture de ses propres intentions uniquement.
-- Aucune policy d'écriture : seul le service role (qui contourne la RLS)
-- crée et règle les intentions. Une intention express (company_id null)
-- n'est lisible par personne via l'API REST — c'est voulu.
-- ------------------------------------------------------------
alter table public.payment_intents enable row level security;

create policy "payment_intents_select_own" on public.payment_intents
  for select using (company_id in (select public.user_company_ids()));

-- ------------------------------------------------------------
-- Application d'une offre — implémentation interne, SANS contrôle
-- de propriété. Extraite de `change_plan` pour être réutilisable par le
-- webhook, qui s'exécute sans session (auth.uid() est null côté service
-- role : `change_plan` y lèverait FORBIDDEN).
--
-- p_actor : auteur du changement pour le journal (null = automate/webhook).
-- L'appelant est responsable de l'autorisation.
-- ------------------------------------------------------------
create or replace function public.apply_plan_change(
  p_company_id uuid,
  p_plan_key text,
  p_actor uuid
)
returns public.subscriptions
language plpgsql
security definer set search_path = public
as $$
declare
  v_sub public.subscriptions%rowtype;
begin
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
  values (p_company_id, p_actor, 'subscription.changed', 'subscription', v_sub.id,
          jsonb_build_object('plan', p_plan_key));

  return v_sub;
end;
$$;

-- Helper interne : jamais appelable via l'API REST.
revoke execute on function public.apply_plan_change(uuid, text, uuid)
  from anon, authenticated, public;

-- ------------------------------------------------------------
-- `change_plan` conserve son contrôle de propriété et délègue désormais
-- l'application à `apply_plan_change` : une seule implémentation.
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

  return public.apply_plan_change(p_company_id, p_plan_key, auth.uid());
end;
$$;

revoke execute on function public.change_plan(uuid, text) from anon, public;
grant execute on function public.change_plan(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- Règlement d'une intention — appelé par le webhook signé.
--
-- Idempotent : la ligne est verrouillée (`for update`), et une intention
-- déjà réglée renvoie son statut sans réinsérer de paiement ni réappliquer
-- l'offre. Un webhook rejoué (ou envoyé deux fois par la passerelle) est
-- donc sans effet — c'est la garantie qu'un client ne paie jamais double.
--
-- @return 'succeeded' | 'failed' | 'pending'
-- @raise  INTENT_NOT_FOUND si la référence est inconnue.
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

  -- Abonnement : l'offre n'est appliquée QUE maintenant, jamais à
  -- l'initiation. Le webhook est la source de vérité unique.
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
revoke execute on function public.settle_payment_intent(text, text, text)
  from anon, authenticated, public;

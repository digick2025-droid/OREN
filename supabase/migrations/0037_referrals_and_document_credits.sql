-- ============================================================
-- 0037 : crédits de documents + parrainage + paiement par document
--
-- Deux besoins, un seul mécanisme :
--   - Parrainage : parrain ET filleul gagnent 1 document offert.
--   - Paiement à l'unité : une fois le quota atteint, on peut acheter des
--     documents (prix = plans.express.per_document_price_fcfa, 500 F par défaut).
--
-- Dans les deux cas, le gain est un « crédit » : un document de plus, hors
-- quota. `assert_quota` ne consomme un crédit que lorsque le quota de l'offre
-- est atteint — un client en offre illimitée ne perd donc jamais rien.
--
-- Les crédits vivent dans une table À PART et non sur `companies` : la
-- politique `companies_update_own` laisse le propriétaire modifier sa ligne,
-- il pourrait donc s'offrir des documents depuis le navigateur. Ici, RLS en
-- lecture seule : seules les fonctions SECURITY DEFINER ci-dessous écrivent.
-- ============================================================

create table public.company_credits (
  company_id uuid primary key references public.companies (id) on delete cascade,
  -- Code à partager (lien /inscription?ref=CODE).
  referral_code text not null unique,
  -- Parrain de cette entreprise (null = inscrit sans parrainage).
  referred_by uuid references public.companies (id) on delete set null,
  -- Date à laquelle le parrain a reçu sa récompense pour CE filleul.
  referral_rewarded_at timestamptz,
  document_credits integer not null default 0 check (document_credits >= 0),
  created_at timestamptz not null default now()
);

create index company_credits_referred_by_idx
  on public.company_credits (referred_by)
  where referred_by is not null;

alter table public.company_credits enable row level security;

create policy "company_credits_select_own" on public.company_credits
  for select using (company_id in (select public.user_company_ids()));
-- Aucune policy d'écriture : insert/update/delete réservés aux fonctions.

-- ------------------------------------------------------------
-- Code de parrainage : 6 caractères hexadécimaux en majuscules, unique.
-- ------------------------------------------------------------
create or replace function public.generate_referral_code()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := 'OREN' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (
      select 1 from public.company_credits where referral_code = v_code
    );
  end loop;
  return v_code;
end;
$$;
revoke execute on function public.generate_referral_code() from anon, authenticated, public;

-- Chaque entreprise reçoit son code à la création.
create or replace function public.create_company_credits()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.company_credits (company_id, referral_code)
  values (new.id, public.generate_referral_code())
  on conflict (company_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.create_company_credits() from anon, authenticated, public;

create trigger companies_create_credits
  after insert on public.companies
  for each row execute function public.create_company_credits();

-- Rattrapage des entreprises existantes.
insert into public.company_credits (company_id, referral_code)
select c.id, public.generate_referral_code()
from public.companies c
on conflict (company_id) do nothing;

-- ------------------------------------------------------------
-- apply_referral : le filleul saisit (ou arrive avec) le code d'un parrain.
--
-- Renvoie un statut texte plutôt que de lever : l'appelant est un effet
-- automatique au premier chargement, un refus n'est pas une erreur.
--   'applied' | 'INVALID_CODE' | 'SELF_REFERRAL' | 'ALREADY_REFERRED' | 'NOT_NEW'
--
-- 'NOT_NEW' : le parrainage est réservé aux comptes qui n'ont encore créé
-- aucun document — sans cela, n'importe qui pourrait se « parrainer » après
-- coup avec le code d'un ami pour gratter un crédit.
-- Le filleul reçoit son crédit tout de suite ; celui du parrain est versé
-- plus tard, au premier document réellement envoyé (voir le trigger).
-- ------------------------------------------------------------
create or replace function public.apply_referral(p_code text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_referrer uuid;
  v_profile public.company_credits%rowtype;
begin
  select id into v_company_id
  from public.companies
  where owner_id = auth.uid() and deleted_at is null;
  if v_company_id is null then
    raise exception 'FORBIDDEN';
  end if;

  select company_id into v_referrer
  from public.company_credits
  where referral_code = upper(trim(coalesce(p_code, '')));
  if v_referrer is null then
    return 'INVALID_CODE';
  end if;
  if v_referrer = v_company_id then
    return 'SELF_REFERRAL';
  end if;

  select * into v_profile
  from public.company_credits
  where company_id = v_company_id
  for update;
  if not found then
    return 'INVALID_CODE';
  end if;
  if v_profile.referred_by is not null then
    return 'ALREADY_REFERRED';
  end if;
  if exists (select 1 from public.documents where company_id = v_company_id) then
    return 'NOT_NEW';
  end if;

  update public.company_credits
  set referred_by = v_referrer,
      document_credits = document_credits + 1
  where company_id = v_company_id;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_company_id, auth.uid(), 'referral.applied', 'company', v_company_id,
          jsonb_build_object('referrer', v_referrer));

  return 'applied';
end;
$$;
revoke execute on function public.apply_referral(text) from anon, public;
grant execute on function public.apply_referral(text) to authenticated;

-- ------------------------------------------------------------
-- Récompense du parrain : au premier document ENVOYÉ du filleul.
--
-- « Envoyé » (status <> 'brouillon') et non « créé » : tout document naît
-- en brouillon, et un compte jetable qui crée un brouillon ne prouve rien.
-- `referral_rewarded_at` rend le versement unique par filleul.
-- ------------------------------------------------------------
create or replace function public.reward_referrer_on_first_send()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_referrer uuid;
begin
  if new.status = 'brouillon' then
    return new;
  end if;

  update public.company_credits
  set referral_rewarded_at = now()
  where company_id = new.company_id
    and referred_by is not null
    and referral_rewarded_at is null
  returning referred_by into v_referrer;

  if v_referrer is not null then
    update public.company_credits
    set document_credits = document_credits + 1
    where company_id = v_referrer;

    insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
    values (v_referrer, null, 'referral.rewarded', 'company', new.company_id,
            jsonb_build_object('referee', new.company_id));
  end if;

  return new;
end;
$$;
revoke execute on function public.reward_referrer_on_first_send() from anon, authenticated, public;

create trigger documents_reward_referrer
  after insert or update of status on public.documents
  for each row execute function public.reward_referrer_on_first_send();

-- ------------------------------------------------------------
-- assert_quota : base = version 0019 (suspension + quota), plus les crédits.
-- Un crédit n'est consommé que si le quota est atteint. Si la création
-- échoue ensuite, la transaction est annulée et le crédit revient.
-- ------------------------------------------------------------
create or replace function public.assert_quota(p_company_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_quota integer;
  v_lifetime boolean;
  v_used integer;
  v_suspended timestamptz;
begin
  select suspended_at into v_suspended from public.companies where id = p_company_id;
  if v_suspended is not null then
    raise exception 'SUSPENDED';
  end if;

  select p.monthly_quota, p.quota_lifetime into v_quota, v_lifetime
  from public.subscriptions s
  join public.plans p on p.key = s.plan_key
  where s.company_id = p_company_id and s.status = 'active' and s.deleted_at is null
  limit 1;

  if not found then
    raise exception 'QUOTA_EXCEEDED';
  end if;
  if v_quota is null then
    return;
  end if;

  select count(*) into v_used from public.documents
  where company_id = p_company_id
    and (v_lifetime or created_at >= date_trunc('month', now()));

  if v_used >= v_quota then
    update public.company_credits
    set document_credits = document_credits - 1
    where company_id = p_company_id and document_credits > 0;
    if found then
      return;
    end if;
    raise exception 'QUOTA_EXCEEDED';
  end if;
end;
$$;
revoke execute on function public.assert_quota(uuid) from anon, authenticated, public;

-- ------------------------------------------------------------
-- get_usage : base = version 0009, plus le solde de crédits.
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
  v_credits integer;
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
    and (v_plan.quota_lifetime or created_at >= date_trunc('month', now()));

  select coalesce(document_credits, 0) into v_credits
  from public.company_credits where company_id = p_company_id;

  return jsonb_build_object(
    'used', v_used,
    'quota', v_plan.monthly_quota,
    'plan_key', v_plan.key,
    'plan_name', v_plan.name,
    'features', coalesce(v_plan.features, '[]'::jsonb),
    'quota_lifetime', v_plan.quota_lifetime,
    'period_end', v_sub.current_period_end,
    'credits', coalesce(v_credits, 0)
  );
end;
$$;

-- ------------------------------------------------------------
-- get_referral_info : code, solde, et combien de filleuls.
-- ------------------------------------------------------------
create or replace function public.get_referral_info(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_profile public.company_credits%rowtype;
begin
  if not exists (
    select 1 from public.companies
    where id = p_company_id and owner_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_profile from public.company_credits where company_id = p_company_id;

  return jsonb_build_object(
    'code', v_profile.referral_code,
    'credits', coalesce(v_profile.document_credits, 0),
    'referred_count', (
      select count(*) from public.company_credits where referred_by = p_company_id
    ),
    'rewarded_count', (
      select count(*) from public.company_credits
      where referred_by = p_company_id and referral_rewarded_at is not null
    ),
    'was_referred', v_profile.referred_by is not null
  );
end;
$$;
revoke execute on function public.get_referral_info(uuid) from anon, public;
grant execute on function public.get_referral_info(uuid) to authenticated;

-- ------------------------------------------------------------
-- Paiement par document : nouvelle finalité d'intention + quantité.
-- ------------------------------------------------------------
alter table public.payment_intents
  drop constraint if exists payment_intents_purpose_check;
alter table public.payment_intents
  add constraint payment_intents_purpose_check
  check (purpose in ('subscription', 'express_document', 'document_credit'));

alter table public.payment_intents
  add column if not exists credits integer not null default 0 check (credits >= 0);

-- ------------------------------------------------------------
-- settle_payment_intent : corps repris de la 0030 (motif d'échec + promo),
-- plus le versement des crédits achetés. Toujours idempotent : une
-- intention déjà réglée sort avant d'atteindre l'ajout de crédits.
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
    perform public.apply_plan_change(v_intent.company_id, v_intent.plan_key, null);
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

-- ============================================================
-- DIGICK Devis — Offre gratuite : quota « à vie » au lieu de mensuel
--
-- Le gratuit passe de « 3 documents / mois » à « 3 documents au total »
-- (jamais réinitialisé). On ajoute un flag quota_lifetime sur les offres
-- plutôt que de coder 'free' en dur : quota_lifetime = true → on compte
-- TOUT l'historique ; sinon on compte le mois en cours (Pro = 25/mois).
-- ============================================================

alter table public.plans
  add column if not exists quota_lifetime boolean not null default false;

update public.plans set quota_lifetime = true where key = 'free';

-- ------------------------------------------------------------
-- assert_quota : compte à vie si quota_lifetime, sinon au mois
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
begin
  select p.monthly_quota, p.quota_lifetime into v_quota, v_lifetime
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
    and (v_lifetime or created_at >= date_trunc('month', now()));

  if v_used >= v_quota then
    raise exception 'QUOTA_EXCEEDED';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- get_usage : idem + expose quota_lifetime au front
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

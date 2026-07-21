-- ============================================================
-- 0019 : cycle de vie des abonnements.
--
-- Correction d'un vrai manque : un abonnement payant restait
-- "active" indéfiniment même après current_period_end (jamais
-- vérifiée nulle part). expire_overdue_subscriptions() tourne
-- désormais toutes les heures via pg_cron et rétrograde vers
-- l'offre gratuite — même chemin que tout changement d'offre
-- (apply_plan_change), donc journalisé dans activity_logs.
--
-- + suspension manuelle d'un compte (abus, impayé persistant).
-- ============================================================

create extension if not exists pg_cron;

create or replace function public.expire_overdue_subscriptions()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_sub record;
begin
  for v_sub in
    select company_id from public.subscriptions
    where status = 'active' and deleted_at is null
      and current_period_end < now()
  loop
    perform public.apply_plan_change(v_sub.company_id, 'free', null);
  end loop;
end;
$$;

revoke execute on function public.expire_overdue_subscriptions() from anon, authenticated, public;

select cron.schedule(
  'expire-overdue-subscriptions',
  '0 * * * *',
  $$select public.expire_overdue_subscriptions()$$
);

-- ------------------------------------------------------------
-- Suspension manuelle
-- ------------------------------------------------------------
alter table public.companies
  add column suspended_at timestamptz,
  add column suspended_reason text;

create or replace function public.admin_set_company_suspended(
  p_company_id uuid,
  p_suspended boolean,
  p_reason text
)
returns public.companies
language plpgsql
security definer set search_path = public
as $$
declare
  v_company public.companies%rowtype;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  update public.companies
  set suspended_at = case when p_suspended then now() else null end,
      suspended_reason = case when p_suspended then p_reason else null end
  where id = p_company_id and deleted_at is null
  returning * into v_company;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_company_id, auth.uid(),
    case when p_suspended then 'company.suspended' else 'company.reactivated' end,
    'company', p_company_id,
    jsonb_build_object('reason', p_reason)
  );

  return v_company;
end;
$$;

revoke execute on function public.admin_set_company_suspended(uuid, boolean, text) from anon, public;
grant execute on function public.admin_set_company_suspended(uuid, boolean, text) to authenticated;

-- assert_quota (0009) redéfinie : défense en profondeur, bloque
-- la création de documents même si le redirect côté layout était
-- contourné.
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
    raise exception 'QUOTA_EXCEEDED';
  end if;
end;
$$;

-- admin_get_stats (0017) redéfinie : ajoute companies_suspended
-- maintenant que la colonne existe.
create or replace function public.admin_get_stats()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select jsonb_build_object(
    'active_subscriptions_by_plan', (
      select coalesce(jsonb_object_agg(plan_key, cnt), '{}'::jsonb)
      from (
        select plan_key, count(*) as cnt
        from public.subscriptions
        where status = 'active' and deleted_at is null
        group by plan_key
      ) s
    ),
    'mrr_fcfa', (
      select coalesce(sum(p.price_fcfa), 0)
      from public.subscriptions s
      join public.plans p on p.key = s.plan_key
      where s.status = 'active' and s.deleted_at is null
    ),
    'revenue_30d_fcfa', (
      select coalesce(sum(amount), 0) from public.payments
      where status = 'succeeded' and created_at >= now() - interval '30 days'
    ),
    'revenue_total_fcfa', (
      select coalesce(sum(amount), 0) from public.payments where status = 'succeeded'
    ),
    'companies_total', (select count(*) from public.companies where deleted_at is null),
    'companies_30d', (
      select count(*) from public.companies
      where deleted_at is null and created_at >= now() - interval '30 days'
    ),
    'documents_30d', (
      select count(*) from public.documents
      where deleted_at is null and created_at >= now() - interval '30 days'
    ),
    'documents_total', (select count(*) from public.documents where deleted_at is null),
    'payment_intents_pending', (
      select count(*) from public.payment_intents where status = 'pending'
    ),
    'payment_intents_failed_7d', (
      select count(*) from public.payment_intents
      where status = 'failed' and created_at >= now() - interval '7 days'
    ),
    'companies_suspended', (
      select count(*) from public.companies
      where deleted_at is null and suspended_at is not null
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_get_stats() from anon, public;
grant execute on function public.admin_get_stats() to authenticated;

-- admin_list_companies (0017) redéfinie : remplace les placeholders
-- suspended_at/suspended_reason par les vraies valeurs. Signature
-- inchangée (même RETURNS TABLE), create or replace suffit.
create or replace function public.admin_list_companies()
returns table (
  company_id uuid,
  name text,
  owner_phone text,
  plan_key text,
  plan_name text,
  subscription_status text,
  current_period_end timestamptz,
  usage_used bigint,
  usage_quota integer,
  last_payment_fcfa integer,
  last_payment_at timestamptz,
  last_sign_in_at timestamptz,
  suspended_at timestamptz,
  suspended_reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    c.id,
    c.name,
    c.phone,
    s.plan_key,
    p.name,
    s.status,
    s.current_period_end,
    (
      select count(*) from public.documents d
      where d.company_id = c.id and d.deleted_at is null
        and (coalesce(p.quota_lifetime, false) or d.created_at >= date_trunc('month', now()))
    ),
    p.monthly_quota,
    lp.amount,
    lp.created_at,
    u.last_sign_in_at,
    c.suspended_at,
    c.suspended_reason,
    c.created_at
  from public.companies c
  left join public.subscriptions s
    on s.company_id = c.id and s.status = 'active' and s.deleted_at is null
  left join public.plans p on p.key = s.plan_key
  left join auth.users u on u.id = c.owner_id
  left join lateral (
    select amount, created_at from public.payments
    where company_id = c.id and status = 'succeeded'
    order by created_at desc
    limit 1
  ) lp on true
  where c.deleted_at is null
  order by c.created_at desc;
end;
$$;

revoke execute on function public.admin_list_companies() from anon, public;
grant execute on function public.admin_list_companies() to authenticated;

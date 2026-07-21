-- ============================================================
-- 0017 : admin_users + is_admin() + lecture cross-tenant pour
-- le dashboard admin (abonnements, stats).
--
-- admin_users est une table plutôt qu'une variable d'env : ça
-- permet d'ajouter d'autres admins plus tard sans redéploiement,
-- et is_admin() peut être réutilisée dans les RLS policies comme
-- user_company_ids() l'est déjà pour le multi-tenant.
-- ============================================================

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "admin_users_select_self" on public.admin_users
  for select using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ------------------------------------------------------------
-- Policies admin : lecture cross-tenant, en plus des policies
-- "_select_own" existantes (0002_rls_policies.sql).
-- ------------------------------------------------------------
create policy "subscriptions_select_admin" on public.subscriptions
  for select using (public.is_admin());

create policy "payments_select_admin" on public.payments
  for select using (public.is_admin());

create policy "payment_intents_select_admin" on public.payment_intents
  for select using (public.is_admin());

-- plans_select_all (0001) ne montre que is_active = true : les
-- admins doivent aussi voir/éditer les offres désactivées.
create policy "plans_select_admin" on public.plans
  for select using (public.is_admin());
create policy "plans_insert_admin" on public.plans
  for insert with check (public.is_admin());
create policy "plans_update_admin" on public.plans
  for update using (public.is_admin()) with check (public.is_admin());

create policy "companies_select_admin" on public.companies
  for select using (public.is_admin());
create policy "companies_update_admin" on public.companies
  for update using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- admin_change_plan : même contrat que change_plan (0016), sans
-- contrôle de propriété — réservé aux admins. Délègue à
-- apply_plan_change (déjà factorisée, déjà révoquée du public).
-- ------------------------------------------------------------
create or replace function public.admin_change_plan(p_company_id uuid, p_plan_key text)
returns public.subscriptions
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  return public.apply_plan_change(p_company_id, p_plan_key, auth.uid());
end;
$$;

revoke execute on function public.admin_change_plan(uuid, text) from anon, public;
grant execute on function public.admin_change_plan(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- admin_get_stats : agrégats pour la vue d'ensemble.
-- Redéfinie dans 0019 pour ajouter companies_suspended une fois
-- la colonne companies.suspended_at créée.
-- ------------------------------------------------------------
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
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_get_stats() from anon, public;
grant execute on function public.admin_get_stats() to authenticated;

-- ------------------------------------------------------------
-- admin_list_companies : liste cross-tenant pour /admin/abonnements.
-- security definer pour pouvoir lire auth.users.last_sign_in_at,
-- inaccessible via PostgREST pour tout autre rôle. suspended_at /
-- suspended_reason renvoient null ici (colonnes ajoutées en 0019) ;
-- la signature reste stable pour permettre un simple `create or
-- replace` dans 0019 (pas de drop function nécessaire).
-- ------------------------------------------------------------
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
    null::timestamptz,
    null::text,
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

-- ------------------------------------------------------------
-- admin_get_company_detail : détail d'une entreprise (usage,
-- historique paiements). Utilise to_jsonb(c) pour la ligne
-- companies entière : les colonnes ajoutées plus tard (suspended_at
-- en 0019) apparaîtront automatiquement, sans redéfinition.
-- ------------------------------------------------------------
create or replace function public.admin_get_company_detail(p_company_id uuid)
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
    'company', to_jsonb(c),
    'last_sign_in_at', u.last_sign_in_at,
    'subscription', to_jsonb(s),
    'plan', to_jsonb(p),
    'usage_used', (
      select count(*) from public.documents d
      where d.company_id = c.id and d.deleted_at is null
        and (coalesce(p.quota_lifetime, false) or d.created_at >= date_trunc('month', now()))
    ),
    'payments', (
      select coalesce(jsonb_agg(to_jsonb(pay) order by pay.created_at desc), '[]'::jsonb)
      from public.payments pay where pay.company_id = c.id
    ),
    'payment_intents', (
      select coalesce(jsonb_agg(to_jsonb(pi) order by pi.created_at desc), '[]'::jsonb)
      from public.payment_intents pi where pi.company_id = c.id
    )
  )
  into v_result
  from public.companies c
  left join public.subscriptions s
    on s.company_id = c.id and s.status = 'active' and s.deleted_at is null
  left join public.plans p on p.key = s.plan_key
  left join auth.users u on u.id = c.owner_id
  where c.id = p_company_id and c.deleted_at is null;

  if v_result is null then
    raise exception 'NOT_FOUND';
  end if;

  return v_result;
end;
$$;

revoke execute on function public.admin_get_company_detail(uuid) from anon, public;
grant execute on function public.admin_get_company_detail(uuid) to authenticated;

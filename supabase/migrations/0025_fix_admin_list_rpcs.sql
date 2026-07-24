-- ============================================================
-- 0025 : les deux listes de l'admin (Abonnements + Utilisateurs)
-- remontaient vides parce que les RPC levaient une erreur à
-- l'exécution, jamais au déploiement (le corps d'une fonction
-- plpgsql n'est pas validé par `create function`).
--
-- 1. admin_list_companies() (0017/0019)
--    ERROR 42702 : column reference "created_at" is ambiguous
--    La sous-requête lateral `lp` sélectionne `amount, created_at`
--    et filtre sur `company_id`/`status` sans qualifier les
--    colonnes ; `created_at` et `company_id` sont aussi des
--    paramètres OUT du RETURNS TABLE, donc plpgsql ne sait pas
--    trancher. => on qualifie tout avec l'alias `pay`.
--    Deuxième défaut du même bloc : `last_payment_fcfa integer`
--    alors que payments.amount est passé en bigint (0010).
--    => bigint (changement de type de sortie : drop obligatoire).
--
-- 2. admin_list_users() (0024)
--    ERROR 42804 : structure of query does not match function
--    result type — auth.users.email est varchar(255), déclaré
--    text. => cast explicite.
-- ============================================================

drop function if exists public.admin_list_companies();

create function public.admin_list_companies()
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
  last_payment_fcfa bigint,
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
    lp.paid_at,
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
    select pay.amount, pay.created_at as paid_at
    from public.payments pay
    where pay.company_id = c.id and pay.status = 'succeeded'
    order by pay.created_at desc
    limit 1
  ) lp on true
  where c.deleted_at is null
  order by c.created_at desc;
end;
$$;

revoke execute on function public.admin_list_companies() from anon, public;
grant execute on function public.admin_list_companies() to authenticated;

-- ------------------------------------------------------------

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  phone text,
  full_name text,
  created_at timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  company_id uuid,
  company_name text,
  company_suspended_at timestamptz,
  plan_key text,
  plan_name text,
  subscription_status text
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
    u.id,
    u.email::text,
    u.phone::text,
    pr.full_name,
    u.created_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    u.banned_until,
    c.id,
    c.name,
    c.suspended_at,
    s.plan_key,
    p.name,
    s.status
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  left join public.companies c on c.owner_id = u.id and c.deleted_at is null
  left join public.subscriptions s
    on s.company_id = c.id and s.status = 'active' and s.deleted_at is null
  left join public.plans p on p.key = s.plan_key
  order by u.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from anon, public;
grant execute on function public.admin_list_users() to authenticated;

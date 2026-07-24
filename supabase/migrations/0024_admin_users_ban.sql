-- ============================================================
-- 0024 : visibilité admin sur TOUS les comptes créés (pas
-- seulement ceux qui ont une entreprise) + bannissement réel au
-- niveau authentification.
--
-- Constat : admin_list_companies() (0017/0019) part de `companies`,
-- donc un compte inscrit dont la création d'entreprise a échoué ou
-- qui n'a jamais confirmé son email est invisible dans l'admin.
-- admin_list_users() part de `auth.users` à la place.
--
-- admin_set_user_banned bannit au niveau auth.users.banned_until
-- (Supabase Auth refuse alors toute nouvelle connexion/rafraîchissement
-- de session) — distinct de la suspension par entreprise déjà en
-- place (companies.suspended_at, bloque l'usage applicatif mais pas
-- la connexion).
-- ============================================================

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
    u.email,
    u.phone,
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

-- ------------------------------------------------------------
-- admin_set_user_banned : bannissement réel (bloque la connexion),
-- couvre aussi les comptes sans entreprise. Un admin ne peut pas
-- être banni via cette fonction (filet de sécurité anti-blocage).
-- ------------------------------------------------------------
create or replace function public.admin_set_user_banned(
  p_user_id uuid,
  p_banned boolean,
  p_reason text default null
)
returns table (user_id uuid, banned_until timestamptz)
language plpgsql
security definer set search_path = public
as $$
declare
  v_banned_until timestamptz;
  v_company_id uuid;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if exists (select 1 from public.admin_users a where a.user_id = p_user_id) then
    raise exception 'CANNOT_BAN_ADMIN';
  end if;

  v_banned_until := case when p_banned then now() + interval '100 years' else null end;

  update auth.users set banned_until = v_banned_until where id = p_user_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select c.id into v_company_id from public.companies c
  where c.owner_id = p_user_id and c.deleted_at is null
  limit 1;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_company_id, auth.uid(),
    case when p_banned then 'user.banned' else 'user.unbanned' end,
    'user', p_user_id,
    jsonb_build_object('reason', p_reason)
  );

  return query select p_user_id, v_banned_until;
end;
$$;

revoke execute on function public.admin_set_user_banned(uuid, boolean, text) from anon, public;
grant execute on function public.admin_set_user_banned(uuid, boolean, text) to authenticated;

-- admin_get_company_detail (0017) redéfinie : expose banned_until
-- du propriétaire pour afficher/actionner le ban depuis la fiche
-- entreprise aussi (même compte, deux points d'entrée).
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
    'banned_until', u.banned_until,
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

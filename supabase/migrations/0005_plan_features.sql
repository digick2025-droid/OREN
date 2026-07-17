-- ============================================================
-- DIGICK Devis — Fonctionnalités par offre (configurées en base)
-- Le catalogue (et plus tard les rapports) est réservé à Business.
-- ============================================================

alter table public.plans
  add column if not exists features jsonb not null default '[]'::jsonb;

update public.plans set features = '["catalog", "reports"]'::jsonb
where key = 'business';

-- get_usage expose désormais les fonctionnalités du plan actif
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
    and created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'used', v_used,
    'quota', v_plan.monthly_quota,
    'plan_key', v_plan.key,
    'plan_name', v_plan.name,
    'features', coalesce(v_plan.features, '[]'::jsonb),
    'period_end', v_sub.current_period_end
  );
end;
$$;

-- ============================================================
-- 0023 : bascule groupée "toutes les offres gratuites" pour
-- l'admin. Le prix d'une offre est déjà éditable une à une via
-- plan-form.tsx (price_fcfa) — ceci ajoute une action groupée
-- sur /admin/offres, réversible : les colonnes snapshot gardent
-- les prix d'origine pour restauration exacte, pas un aller simple.
-- ============================================================

alter table public.plans add column if not exists promo_price_snapshot_fcfa bigint;
alter table public.plans add column if not exists promo_per_doc_snapshot_fcfa bigint;

-- ------------------------------------------------------------
-- admin_set_all_plans_free : passe toutes les offres payantes à
-- 0 F en sauvegardant leurs prix actuels. Idempotent : une offre
-- déjà en mode promo (snapshot non null) n'est pas re-snapshotée.
-- ------------------------------------------------------------
create or replace function public.admin_set_all_plans_free()
returns setof public.plans
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  update public.plans
  set
    promo_price_snapshot_fcfa = price_fcfa,
    promo_per_doc_snapshot_fcfa = per_document_price_fcfa,
    price_fcfa = 0,
    per_document_price_fcfa = case when per_document_price_fcfa is not null then 0 else null end
  where promo_price_snapshot_fcfa is null
    and (price_fcfa > 0 or coalesce(per_document_price_fcfa, 0) > 0);

  return query select * from public.plans order by sort_order;
end;
$$;

revoke execute on function public.admin_set_all_plans_free() from anon, public;
grant execute on function public.admin_set_all_plans_free() to authenticated;

-- ------------------------------------------------------------
-- admin_restore_plan_prices : annule la promo, remet les prix
-- d'origine sauvegardés par admin_set_all_plans_free.
-- ------------------------------------------------------------
create or replace function public.admin_restore_plan_prices()
returns setof public.plans
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  update public.plans
  set
    price_fcfa = promo_price_snapshot_fcfa,
    per_document_price_fcfa = promo_per_doc_snapshot_fcfa,
    promo_price_snapshot_fcfa = null,
    promo_per_doc_snapshot_fcfa = null
  where promo_price_snapshot_fcfa is not null;

  return query select * from public.plans order by sort_order;
end;
$$;

revoke execute on function public.admin_restore_plan_prices() from anon, public;
grant execute on function public.admin_restore_plan_prices() to authenticated;

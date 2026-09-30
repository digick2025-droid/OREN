-- ============================================================
-- 0036 : lancement gratuit — plus aucun prix, plus aucun plafond.
--
-- Le code (src/lib/billing.ts, FREE_LAUNCH) retire tous les écrans
-- de paiement, mais le quota est appliqué en base par assert_quota :
-- sans cette migration, l'offre Gratuit continue de bloquer au 4ᵉ
-- document alors que l'interface promet l'illimité. Les deux vont
-- donc ensemble.
--
-- Réversible : prix ET quotas d'origine sont sauvegardés colonne par
-- colonne (restore_plan_prices les remet à l'identique). On ne touche
-- pas `features` : elle est éditable en production depuis /admin/offres
-- et l'écraser ici rejouerait l'erreur corrigée en 0008 — le
-- déverrouillage des fonctionnalités est porté par FREE_LAUNCH côté
-- code, pas par une écriture de données.
--
-- Idempotente : les deux `update` sont gardés par leur marqueur de
-- sauvegarde, un rejeu (`supabase db push` sur une base déjà à jour)
-- est donc un no-op et n'écrase aucun réglage admin.
-- ============================================================

-- `monthly_quota = null` est une valeur légitime (illimité) : la colonne
-- snapshot ne peut donc pas servir de marqueur, d'où le booléen.
alter table public.plans
  add column if not exists promo_quota_snapshot integer,
  add column if not exists promo_quota_snapshotted boolean not null default false;

comment on column public.plans.promo_quota_snapshot is
  'Quota avant bascule « tout gratuit » — restauré par restore_plan_prices().';
comment on column public.plans.promo_quota_snapshotted is
  'true = le quota de cette offre est sauvegardé et l''offre est passée en illimité.';

-- ------------------------------------------------------------
-- set_all_plans_free : cœur de la bascule, sans contrôle d'accès.
-- Appelée par la migration et par le wrapper admin (qui, lui, vérifie
-- is_admin()). Révoquée de tout le monde : jamais appelable depuis un
-- navigateur.
-- ------------------------------------------------------------
create or replace function public.set_all_plans_free()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Prix : sauvegarde puis 0 F. `per_document_price_fcfa` reste null
  -- quand il l'était (l'offre n'est pas à l'usage), sinon passe à 0.
  update public.plans
  set
    promo_price_snapshot_fcfa = price_fcfa,
    promo_per_doc_snapshot_fcfa = per_document_price_fcfa,
    price_fcfa = 0,
    per_document_price_fcfa =
      case when per_document_price_fcfa is not null then 0 else null end
  where promo_price_snapshot_fcfa is null
    and (price_fcfa > 0 or coalesce(per_document_price_fcfa, 0) > 0);

  -- Quotas : sauvegarde puis illimité. C'est cette moitié qui rend la
  -- gratuité réelle — le prix à 0 F ne débloquait pas l'offre Gratuit,
  -- plafonnée à 3 documents à vie.
  update public.plans
  set
    promo_quota_snapshot = monthly_quota,
    promo_quota_snapshotted = true,
    monthly_quota = null
  where not promo_quota_snapshotted;
end;
$$;

-- ------------------------------------------------------------
-- restore_plan_prices : remet prix et quotas d'origine.
-- ------------------------------------------------------------
create or replace function public.restore_plan_prices()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.plans
  set
    price_fcfa = promo_price_snapshot_fcfa,
    per_document_price_fcfa = promo_per_doc_snapshot_fcfa,
    promo_price_snapshot_fcfa = null,
    promo_per_doc_snapshot_fcfa = null
  where promo_price_snapshot_fcfa is not null;

  update public.plans
  set
    monthly_quota = promo_quota_snapshot,
    promo_quota_snapshot = null,
    promo_quota_snapshotted = false
  where promo_quota_snapshotted;
end;
$$;

-- `revoke ... from public` seul ne protège rien : anon et authenticated
-- sont nommés explicitement.
revoke execute on function public.set_all_plans_free() from anon, authenticated, public;
revoke execute on function public.restore_plan_prices() from anon, authenticated, public;

-- ------------------------------------------------------------
-- Les deux RPC admin délèguent désormais au cœur commun, pour que le
-- bouton de /admin/offres et la migration fassent exactement la même
-- chose (quotas inclus — ce que la version 0023 ne faisait pas).
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

  perform public.set_all_plans_free();
  return query select * from public.plans order by sort_order;
end;
$$;

create or replace function public.admin_restore_plan_prices()
returns setof public.plans
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  perform public.restore_plan_prices();
  return query select * from public.plans order by sort_order;
end;
$$;

revoke execute on function public.admin_set_all_plans_free() from anon, public;
revoke execute on function public.admin_restore_plan_prices() from anon, public;
grant execute on function public.admin_set_all_plans_free() to authenticated;
grant execute on function public.admin_restore_plan_prices() to authenticated;

-- ------------------------------------------------------------
-- Bascule effective.
-- ------------------------------------------------------------
select public.set_all_plans_free();

-- ============================================================
-- OREN — M4 : sémantique du quota 0 alignée sur calculations.ts
--
-- Convention (cf. 0001 et src/lib/calculations.ts canCreateDocument) :
--   monthly_quota = null → illimité
--   monthly_quota = 0    → paiement à l'usage (création TOUJOURS permise,
--                          le paiement est exigé en aval)  ← offre Express
--   monthly_quota > 0    → compteur strict (mensuel, ou à vie si quota_lifetime)
--
-- BUG corrigé : assert_quota tombait sur `v_used >= 0` pour un quota 0
-- et levait donc systématiquement QUOTA_EXCEEDED — bloquant totalement
-- l'offre « paiement à l'usage ». On traite désormais 0 comme null.
-- ============================================================

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

  -- pas d'abonnement actif = bloqué
  if not found then
    raise exception 'QUOTA_EXCEEDED';
  end if;

  -- null = illimité ; 0 = paiement à l'usage → toujours permis ici
  if v_quota is null or v_quota = 0 then
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

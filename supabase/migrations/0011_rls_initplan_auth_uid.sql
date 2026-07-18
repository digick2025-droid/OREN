-- ============================================================
-- OREN — M1 : optimisation RLS (auth_rls_initplan)
--
-- `auth.uid()` appelé directement dans une policy est ré-évalué
-- pour CHAQUE ligne. En l'encapsulant dans un sous-select
-- `(select auth.uid())`, PostgreSQL l'évalue une seule fois
-- (initPlan) → gros gain sur les scans.
--
-- Les policies clients/catalog/documents/... utilisent déjà la forme
-- `company_id in (select public.user_company_ids())` (sous-requête,
-- donc déjà optimisée). Seules profiles et companies référençaient
-- `auth.uid()` en direct : on les recrée.
-- ============================================================

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ------------------------------------------------------------
-- companies
-- ------------------------------------------------------------
drop policy if exists "companies_select_own" on public.companies;
drop policy if exists "companies_insert_own" on public.companies;
drop policy if exists "companies_update_own" on public.companies;

create policy "companies_select_own" on public.companies
  for select using (owner_id = (select auth.uid()));
create policy "companies_insert_own" on public.companies
  for insert with check (owner_id = (select auth.uid()));
create policy "companies_update_own" on public.companies
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

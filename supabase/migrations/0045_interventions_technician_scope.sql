-- ============================================================
-- 0045 : OREN ENTREPRISE — cloisonnement fin des interventions
--
-- Phase 2 laissait tous les membres voir toutes les interventions
-- (0040, « accès par appartenance »). On resserre : le TECHNICIEN ne
-- voit et ne modifie que les interventions qui lui sont affectées
-- (assigned_to = lui). Les rôles bureau (gérant, dispatcheur,
-- commercial, comptable) et le propriétaire gardent la vue complète.
--
-- Attention : has_company_role() renvoie TOUJOURS true pour le
-- propriétaire (clause owner, 0037). On ne peut donc pas tester
-- « est technicien » ; on teste « a un rôle bureau » et le technicien
-- pur (aucun rôle bureau, non-propriétaire) retombe sur assigned_to.
-- ============================================================

-- Rôles qui voient toutes les interventions de l'entreprise.
-- (bureau = tout sauf technicien ; le propriétaire matche via la
-- clause owner de has_company_role.)
--   lecture  : gérant, dispatcheur, commercial, comptable
--   écriture : gérant, dispatcheur (ceux qui planifient et affectent)

drop policy if exists "interventions_select_own" on public.interventions;
drop policy if exists "interventions_insert_own" on public.interventions;
drop policy if exists "interventions_update_own" on public.interventions;

-- SELECT : membre bureau → toutes ; technicien → seulement les siennes.
create policy "interventions_select_scoped" on public.interventions
  for select using (
    company_id in (select public.user_company_ids())
    and (
      public.has_company_role(
        company_id,
        array['gerant', 'dispatcheur', 'commercial', 'comptable']
      )
      or assigned_to = auth.uid()
    )
  );

-- INSERT : gérant/dispatcheur créent et affectent librement ; un
-- technicien ne peut créer qu'une intervention qui lui est affectée
-- (saisie de son propre passage terrain).
create policy "interventions_insert_scoped" on public.interventions
  for insert with check (
    company_id in (select public.user_company_ids())
    and (
      public.has_company_role(company_id, array['gerant', 'dispatcheur'])
      or assigned_to = auth.uid()
    )
  );

-- UPDATE : gérant/dispatcheur sur toutes ; technicien sur les siennes
-- (changement de statut, compte-rendu). Le with_check empêche un
-- technicien de réaffecter l'intervention à un autre.
create policy "interventions_update_scoped" on public.interventions
  for update using (
    company_id in (select public.user_company_ids())
    and (
      public.has_company_role(company_id, array['gerant', 'dispatcheur'])
      or assigned_to = auth.uid()
    )
  )
  with check (
    company_id in (select public.user_company_ids())
    and (
      public.has_company_role(company_id, array['gerant', 'dispatcheur'])
      or assigned_to = auth.uid()
    )
  );

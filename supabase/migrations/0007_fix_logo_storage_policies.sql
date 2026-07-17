-- ------------------------------------------------------------
-- 0007 : correction de l'upload du logo
--
-- Les policies d'écriture du bucket "logos" (0002) vérifiaient
-- l'appartenance via une sous-requête directe sur public.companies,
-- exécutée en tant que rôle "authenticated" depuis le contexte RLS
-- de storage.objects. Cette imbrication échoue à résoudre
-- l'entreprise du propriétaire → l'upload est rejeté avec
-- « new row violates row-level security policy ».
--
-- Correctif : passer par public.user_company_ids(), une fonction
-- SECURITY DEFINER (définie en 0004) qui renvoie de façon fiable
-- les id d'entreprise de l'utilisateur courant.
--
-- De plus, 0004 avait supprimé la policy de lecture "logos_public_read"
-- sans la remplacer. Or le client storage relit l'objet juste après
-- l'upload : sans policy SELECT, cette relecture est refusée et l'upload
-- échoue. On rétablit donc une lecture réservée au propriétaire
-- (l'affichage public du logo passe par l'URL publique, sans RLS).
-- ------------------------------------------------------------

drop policy if exists "logos_owner_write" on storage.objects;
drop policy if exists "logos_owner_update" on storage.objects;
drop policy if exists "logos_owner_delete" on storage.objects;
drop policy if exists "logos_owner_read" on storage.objects;

create policy "logos_owner_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

create policy "logos_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

create policy "logos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

create policy "logos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

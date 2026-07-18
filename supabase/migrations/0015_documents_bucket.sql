-- ------------------------------------------------------------
-- 0015 : bucket privé « documents » pour le partage de devis/factures
--
-- Le partage WhatsApp dépose le rendu A4 autonome (HTML inline, prêt
-- pour « Imprimer → PDF » côté destinataire) dans Supabase Storage,
-- puis renvoie une URL signée (voir src/services/pdf/share.ts).
--
-- Bucket PRIVÉ : le destinataire ouvre le document via l'URL signée
-- (qui contourne la RLS), donc aucune lecture publique n'est requise.
-- Les policies ci-dessous ne servent qu'à l'application elle-même
-- (upload + relecture pour signer), scopées au dossier = id de
-- l'entreprise, via public.user_company_ids() (SECURITY DEFINER, 0004) —
-- même modèle que le bucket « logos » corrigé en 0007.
--
-- Le client storage relit l'objet juste après l'upload pour générer
-- l'URL signée : sans policy SELECT, cette relecture est refusée. On
-- fournit donc read + write + update + delete au propriétaire.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_owner_read" on storage.objects;
drop policy if exists "documents_owner_write" on storage.objects;
drop policy if exists "documents_owner_update" on storage.objects;
drop policy if exists "documents_owner_delete" on storage.objects;

create policy "documents_owner_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

create policy "documents_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

create policy "documents_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

create policy "documents_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

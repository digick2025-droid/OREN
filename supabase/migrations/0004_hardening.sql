-- ============================================================
-- DIGICK Devis — Durcissement (suite aux advisors Supabase)
-- ============================================================

-- search_path figé sur le trigger générique
alter function public.set_updated_at() set search_path = public;

-- Les fonctions métier ne sont exécutables que par les utilisateurs
-- connectés ; jamais par le rôle anonyme.
revoke execute on function public.create_document(uuid, jsonb) from anon, public;
revoke execute on function public.convert_document_to_invoice(uuid) from anon, public;
revoke execute on function public.change_plan(uuid, text) from anon, public;
revoke execute on function public.get_usage(uuid) from anon, public;
revoke execute on function public.user_company_ids() from anon, public;

-- Les helpers internes ne sont pas appelables via l'API REST du tout
-- (ils s'exécutent au sein des fonctions définer / triggers).
revoke execute on function public.next_document_number(uuid, text) from anon, authenticated, public;
revoke execute on function public.assert_quota(uuid) from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.handle_new_company() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;

-- Grants explicites : les utilisateurs connectés peuvent appeler
-- les fonctions métier ; user_company_ids est requis par les
-- politiques RLS.
grant execute on function public.create_document(uuid, jsonb) to authenticated;
grant execute on function public.convert_document_to_invoice(uuid) to authenticated;
grant execute on function public.change_plan(uuid, text) to authenticated;
grant execute on function public.get_usage(uuid) to authenticated;
grant execute on function public.user_company_ids() to authenticated;

-- Le bucket public "logos" sert les fichiers par URL publique ;
-- inutile d'autoriser le listage de tous les objets.
drop policy if exists "logos_public_read" on storage.objects;

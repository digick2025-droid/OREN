-- ============================================================
-- 0034 : contenu marketing de l'offre Gratuit.
--
-- L'offre Gratuit existait déjà en base (prix 0, is_active) mais
-- /offres l'excluait explicitement (`.neq("key", "free")`) faute de
-- contenu marketing — elle n'apparaissait donc que sur la home,
-- jamais sur /offres. Texte repris mot pour mot de la home
-- (land_price_free_desc) et du protocole CRO du 04/08/2026.
-- ============================================================

update public.plans set marketing = jsonb_build_object(
  'fr', jsonb_build_object(
    'tag', '3 documents offerts à vie. De quoi tester en conditions réelles, sans engagement.',
    'audience', 'Pour tester',
    'features', jsonb_build_array(
      '3 documents offerts', 'Aperçu PDF professionnel', 'Envoi WhatsApp', 'Sans carte bancaire'
    )
  ),
  'en', jsonb_build_object(
    'tag', '3 free documents, for life. Enough to test in real conditions, no commitment.',
    'audience', 'For testing',
    'features', jsonb_build_array(
      '3 free documents', 'Professional PDF preview', 'WhatsApp sharing', 'No credit card'
    )
  )
)
where key = 'free';

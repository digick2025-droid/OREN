-- ============================================================
-- 0021 : contenu marketing des offres en base.
--
-- Avant cette migration, le prix/quota de /offres venaient déjà de
-- la table `plans`, mais le texte marketing (accroche, cible,
-- liste de fonctionnalités) était codé en dur dans
-- offres/page.tsx (fonction planContent) + les dictionnaires
-- i18n — donc "sans coder" ne s'appliquait pas encore à ça.
-- Seed = reprise exacte du contenu actuel des dictionnaires fr/en.
-- ============================================================

alter table public.plans add column if not exists marketing jsonb not null default '{}'::jsonb;

update public.plans set marketing = jsonb_build_object(
  'fr', jsonb_build_object(
    'tag', 'Payez à l''usage, sans compte',
    'audience', 'Usage occasionnel',
    'features', jsonb_build_array(
      '1 devis à la fois', 'Aperçu PDF professionnel', 'Envoi WhatsApp', 'Sans inscription'
    )
  ),
  'en', jsonb_build_object(
    'tag', 'Pay as you go, no account',
    'audience', 'Occasional use',
    'features', jsonb_build_array(
      '1 quote at a time', 'Professional PDF preview', 'WhatsApp sharing', 'No sign-up'
    )
  )
)
where key = 'express';

update public.plans set marketing = jsonb_build_object(
  'fr', jsonb_build_object(
    'tag', 'L''essentiel pour facturer vite',
    'audience', 'Artisans indépendants',
    'features', jsonb_build_array(
      'Profil entreprise', 'Devis & factures', 'Gestion des clients',
      '25 documents / mois', 'Partage WhatsApp'
    )
  ),
  'en', jsonb_build_object(
    'tag', 'The essentials to bill fast',
    'audience', 'Independent tradespeople',
    'features', jsonb_build_array(
      'Company profile', 'Quotes & invoices', 'Client management',
      '25 documents / month', 'WhatsApp sharing'
    )
  )
)
where key = 'pro';

update public.plans set marketing = jsonb_build_object(
  'fr', jsonb_build_object(
    'tag', 'Pour aller plus loin',
    'audience', 'Entreprises qui grandissent',
    'features', jsonb_build_array(
      'Tout OREN Pro', 'Documents illimités', 'Catalogue & modèles', 'Rapports simples'
    )
  ),
  'en', jsonb_build_object(
    'tag', 'To go further',
    'audience', 'Growing businesses',
    'features', jsonb_build_array(
      'All of OREN Pro', 'Unlimited documents', 'Catalog & templates', 'Simple reports'
    )
  )
)
where key = 'business';

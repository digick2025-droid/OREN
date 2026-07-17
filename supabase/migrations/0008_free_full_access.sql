-- ============================================================
-- DIGICK Devis — Offre gratuite : accès complet à l'outil
-- Les nouveaux utilisateurs démarrent sur l'offre « free » avec
-- toutes les fonctionnalités débloquées (catalogue, rapports,
-- proforma, logo, acompte), dans la limite de 3 documents / mois.
-- Seul le quota (monthly_quota = 3) borne l'usage — jamais les
-- fonctionnalités.
-- ============================================================

update public.plans
set features = '["catalog", "reports", "proforma", "logo", "advance"]'::jsonb
where key = 'free';

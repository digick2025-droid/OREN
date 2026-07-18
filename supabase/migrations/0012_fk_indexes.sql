-- ============================================================
-- OREN — M2 : index sur les clés étrangères non couvertes
--
-- Une FK sans index sur la colonne source pénalise les jointures
-- et surtout les suppressions/mises à jour en cascade côté parent
-- (scan séquentiel de la table enfant). On indexe les FK qui
-- n'avaient aucun index avec la colonne en tête.
--
-- Déjà couvertes (index existants) : clients.company_id,
-- catalog_items.company_id, documents.company_id,
-- document_items.document_id, subscriptions.company_id,
-- payments.company_id, activity_logs.company_id,
-- document_counters.company_id.
-- ============================================================

create index if not exists documents_client_idx
  on public.documents (client_id);

create index if not exists documents_converted_from_idx
  on public.documents (converted_from);

create index if not exists subscriptions_plan_key_idx
  on public.subscriptions (plan_key);

create index if not exists payments_subscription_idx
  on public.payments (subscription_id);

create index if not exists payments_document_idx
  on public.payments (document_id);

create index if not exists activity_logs_actor_idx
  on public.activity_logs (actor_id);

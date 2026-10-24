"use client";

import { useIsAdmin } from "@/hooks/use-is-admin";
import { usePlanFeature } from "@/hooks/use-usage";
import { ENTERPRISE_PREVIEW } from "@/lib/billing";

/**
 * Accès au module OREN ENTREPRISE (équipe & rôles, puis interventions).
 *
 * Ouvert si l'offre active porte la feature `members`, OU en preview
 * (`ENTERPRISE_PREVIEW`), OU pour un admin — ce dernier cas permet de
 * « voir le travail sans l'activer pour les utilisateurs » : le compte admin
 * voit l'espace, personne d'autre.
 */
export function useEnterpriseAccess(): boolean {
  const { enabled } = usePlanFeature("members");
  const isAdmin = useIsAdmin();
  return enabled || ENTERPRISE_PREVIEW || isAdmin;
}

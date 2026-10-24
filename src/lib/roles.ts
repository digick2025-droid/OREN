import type { CompanyRole, InvitationRole } from "@/types/database";

/** Libellés FR des rôles d'équipe (OREN ENTREPRISE, migrations 0037/0038). */
export const ROLE_LABELS: Record<CompanyRole, string> = {
  gerant: "Gérant",
  dispatcheur: "Dispatcheur",
  commercial: "Commercial",
  technicien: "Technicien",
  comptable: "Comptable",
};

/** Courte description du périmètre de chaque rôle (affichée à l'invitation). */
export const ROLE_HINTS: Record<CompanyRole, string> = {
  gerant: "Accès complet, facturation et équipe",
  dispatcheur: "Planifie et affecte les interventions",
  commercial: "Devis, factures et clients",
  technicien: "Ses interventions sur le terrain",
  comptable: "Suivi financier et rapports",
};

/** Rôles assignables à un membre existant (le gérant inclus). */
export const ASSIGNABLE_ROLES: CompanyRole[] = [
  "gerant",
  "dispatcheur",
  "commercial",
  "technicien",
  "comptable",
];

/** Rôles proposables à l'invitation (« gerant » exclu — c'est le propriétaire). */
export const INVITABLE_ROLES: InvitationRole[] = [
  "dispatcheur",
  "commercial",
  "technicien",
  "comptable",
];

/**
 * Peut créer, affecter et supprimer des interventions (vue bureau).
 * Le technicien, lui, ne gère que ses interventions affectées (statut,
 * compte-rendu) — cf. RLS 0045. `null` = propriétaire/admin/rôle non
 * encore résolu : on laisse l'UI complète, la RLS reste la vérité.
 */
export function canManageInterventions(role: CompanyRole | null): boolean {
  return role === null || role === "gerant" || role === "dispatcheur";
}

/** Technicien de terrain : accès restreint à ses propres interventions. */
export function isFieldTechnician(role: CompanyRole | null): boolean {
  return role === "technicien";
}

/**
 * Accès aux données financières (trésorerie, dépenses) : rôles bureau
 * financiers. `null` = propriétaire/admin/non résolu → accès (la RLS 0050
 * reste la vérité).
 */
export function canSeeTreasury(role: CompanyRole | null): boolean {
  return (
    role === null ||
    role === "gerant" ||
    role === "dispatcheur" ||
    role === "comptable"
  );
}

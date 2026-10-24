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

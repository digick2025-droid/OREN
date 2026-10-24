import type { ContractFrequency, ContractStatus } from "@/types/database";

export const CONTRACT_FREQUENCIES: ContractFrequency[] = [
  "mensuel",
  "trimestriel",
  "semestriel",
  "annuel",
];

export const CONTRACT_FREQUENCY_LABELS: Record<ContractFrequency, string> = {
  mensuel: "Mensuel",
  trimestriel: "Trimestriel",
  semestriel: "Semestriel",
  annuel: "Annuel",
};

export const CONTRACT_STATUSES: ContractStatus[] = [
  "actif",
  "suspendu",
  "termine",
];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  actif: "Actif",
  suspendu: "Suspendu",
  termine: "Terminé",
};

/** Pastille de statut (tokens sémantiques dark-aware, cf. globals.css). */
export const CONTRACT_STATUS_CLASSES: Record<ContractStatus, string> = {
  actif: "bg-success/10 text-success",
  suspendu: "bg-warning/10 text-warning",
  termine: "bg-muted text-muted-foreground",
};

/** Échéance proche (≤ 7 jours) ou dépassée, pour un contrat actif. */
export function isDueSoon(nextDue: string): boolean {
  const due = new Date(nextDue);
  due.setHours(0, 0, 0, 0);
  const limit = new Date();
  limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() + 7);
  return due.getTime() <= limit.getTime();
}

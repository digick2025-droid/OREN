import type { InterventionStatus } from "@/types/database";

/** Cycle de vie d'une intervention, dans l'ordre d'avancement. */
export const INTERVENTION_STATUSES: InterventionStatus[] = [
  "a_planifier",
  "planifiee",
  "en_cours",
  "terminee",
  "annulee",
];

export const INTERVENTION_STATUS_LABELS: Record<InterventionStatus, string> = {
  a_planifier: "À planifier",
  planifiee: "Planifiée",
  en_cours: "En cours",
  terminee: "Terminée",
  annulee: "Annulée",
};

/** Classes de pastille (tokens sémantiques dark-aware, cf. globals.css). */
export const INTERVENTION_STATUS_CLASSES: Record<InterventionStatus, string> = {
  a_planifier: "bg-muted text-muted-foreground",
  planifiee: "bg-info/10 text-info",
  en_cours: "bg-warning/10 text-warning",
  terminee: "bg-success/10 text-success",
  annulee: "bg-error/10 text-error",
};

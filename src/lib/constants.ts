import type { DocumentStatus } from "@/types/database";

export const APP_NAME = "OREN";

export type StatusVariant = "neutral" | "info" | "success" | "error" | "warning";

/** Statut → variante Badge (pilule teintée, dark-aware). */
export const STATUS_VARIANT: Record<DocumentStatus, StatusVariant> = {
  brouillon: "neutral",
  envoye: "info",
  accepte: "success",
  refuse: "error",
  paye: "success",
};

/** Statut → pilule pleine (état sélectionné du sélecteur de statut). */
export const STATUS_SOLID: Record<DocumentStatus, string> = {
  brouillon: "bg-muted-foreground text-white",
  envoye: "bg-info text-white",
  accepte: "bg-success text-white",
  refuse: "bg-error text-white",
  paye: "bg-success text-white",
};

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "brouillon",
  "envoye",
  "accepte",
  "refuse",
  "paye",
];

export const UNITS = ["unité", "mètre", "m²", "forfait", "heure", "jour", "litre"] as const;

/** Couleurs proposées pour la personnalisation entreprise */
export const COMPANY_COLORS = [
  "#0F172A",
  "#FF6B57",
  "#16A34A",
  "#3B82F6",
  "#7C3AED",
  "#B45309",
] as const;

export const DEFAULT_COMPANY_COLOR = "#0F172A";

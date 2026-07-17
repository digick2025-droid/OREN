import type { DocumentStatus } from "@/types/database";

export const APP_NAME = "DIGICK Devis";

/** Couleurs de statut (référence prototype) */
export const STATUS_STYLES: Record<DocumentStatus, { bg: string; color: string }> = {
  brouillon: { bg: "#EEF0F4", color: "#5A6377" },
  envoye: { bg: "#E8EFFD", color: "#2E6BE6" },
  accepte: { bg: "#E4F5EE", color: "#1E9E6A" },
  refuse: { bg: "#FBE9E9", color: "#D64545" },
  paye: { bg: "#E4F5EE", color: "#1E9E6A" },
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
  "#131F35",
  "#FF5A50",
  "#1E9E6A",
  "#2E6BE6",
  "#7A4FD3",
  "#B25E09",
] as const;

export const DEFAULT_COMPANY_COLOR = "#131F35";

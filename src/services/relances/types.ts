/**
 * Relances push — formes de données échangées entre la collecte (route cron,
 * qui parle à Supabase) et la décision (`select.ts`, pure et testée).
 */

import type { Lang } from "@/lib/i18n/config";

export type RelanceKind =
  | "facture_impayee"
  | "devis_en_attente"
  | "compte_inacheve"
  | "inactivite";

/** Document en jeu dans une relance (devis en attente, facture impayée). */
export interface RelanceDocument {
  id: string;
  number: string;
  clientName: string;
  total: number;
  /** Date d'émission ISO — c'est elle qui fait vieillir le document. */
  issueDate: string;
}

/** Une relance déjà envoyée, telle que journalisée dans `relance_logs`. */
export interface RelanceLog {
  kind: RelanceKind;
  documentId: string | null;
  sentAt: string;
}

/** Tout ce que l'on sait d'un utilisateur au moment de décider. */
export interface RelanceCandidate {
  userId: string;
  lang: Lang;
  /** Inscription — sert à ne pas relancer un compte créé il y a une heure. */
  createdAt: string;
  /** Dernière ouverture de l'application ; null = jamais vu depuis l'ajout. */
  lastSeenAt: string | null;
  hasCompany: boolean;
  /** Entreprise suspendue : on ne pousse rien vers un compte bloqué. */
  companySuspended: boolean;
  documentsCount: number;
  pendingQuotes: RelanceDocument[];
  unpaidInvoices: RelanceDocument[];
  recentLogs: RelanceLog[];
}

/** Ce que l'on décide d'envoyer — au plus une relance par utilisateur. */
export interface RelanceDecision {
  userId: string;
  kind: RelanceKind;
  documentId: string | null;
  title: string;
  body: string;
  /** Page ouverte au clic sur la notification. */
  url: string;
}

/**
 * Relances push — décide, pour un utilisateur, s'il faut lui envoyer une
 * notification aujourd'hui et laquelle.
 *
 * Fonction pure, sans accès réseau ni base : c'est la seule partie du système
 * qu'on peut éprouver, et c'est celle qui compte. Une erreur ici ne casse pas
 * l'application — elle envoie trois notifications par jour à un artisan qui
 * les coupera, et une notification coupée ne se rallume jamais.
 */

import { formatAmount } from "@/lib/format";
import type { Lang } from "@/lib/i18n/config";
import type {
  RelanceCandidate,
  RelanceDecision,
  RelanceDocument,
  RelanceKind,
  RelanceLog,
} from "./types";

/** Jours sans ouvrir l'application avant une relance de réengagement. */
export const INACTIVITE_JOURS = 7;
/** Âge d'un devis « envoyé » toujours sans réponse avant de le rappeler. */
export const DEVIS_ATTENTE_JOURS = 3;
/** Âge d'une facture « envoyée » toujours pas réglée avant de la rappeler. */
export const FACTURE_IMPAYEE_JOURS = 7;
/** Délai après l'inscription avant de relancer un compte resté inachevé. */
export const COMPTE_INACHEVE_JOURS = 2;

/** Deux relances d'inactivité ne se suivent pas de plus près que ça. */
export const DELAI_MEME_TYPE_JOURS = 14;
/** Un document donné ne déclenche pas deux relances avant ce délai. */
export const DELAI_MEME_DOCUMENT_JOURS = 14;
/** Plafond global, tous types confondus, sur une fenêtre glissante. */
export const MAX_PAR_FENETRE = 2;
export const FENETRE_JOURS = 7;
/** Un compte inachevé est relancé deux fois, puis on le laisse tranquille. */
export const MAX_COMPTE_INACHEVE = 2;

const JOUR_MS = 24 * 60 * 60 * 1000;

function joursDepuis(iso: string, maintenant: Date): number {
  return (maintenant.getTime() - new Date(iso).getTime()) / JOUR_MS;
}

function logsDepuis(
  logs: RelanceLog[],
  jours: number,
  maintenant: Date,
): RelanceLog[] {
  return logs.filter((l) => joursDepuis(l.sentAt, maintenant) < jours);
}

/** Le document le plus ancien d'abord : c'est le plus urgent à traiter. */
function plusAncien(documents: RelanceDocument[]): RelanceDocument | undefined {
  return [...documents].sort(
    (a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime(),
  )[0];
}

/**
 * Textes des notifications. Volontairement au ras des faits : un montant, un
 * nom de client, un nombre de jours. Une relance vague (« Revenez vite ! »)
 * se fait couper, une relance qui rappelle une facture impayée s'ouvre.
 */
const TEXTES: Record<
  RelanceKind,
  Record<Lang, (v: { doc?: RelanceDocument; jours: number }) => [string, string]>
> = {
  facture_impayee: {
    fr: ({ doc, jours }) => [
      `Facture ${doc?.number} toujours impayée`,
      `${doc?.clientName} n'a pas encore réglé ${formatAmount(doc?.total ?? 0)}, envoyée il y a ${Math.round(jours)} jours. Relancez en un tap.`,
    ],
    en: ({ doc, jours }) => [
      `Invoice ${doc?.number} still unpaid`,
      `${doc?.clientName} hasn't paid ${formatAmount(doc?.total ?? 0)} yet, sent ${Math.round(jours)} days ago. Follow up in one tap.`,
    ],
  },
  devis_en_attente: {
    fr: ({ doc, jours }) => [
      `Devis ${doc?.number} sans réponse`,
      `${doc?.clientName} n'a pas répondu depuis ${Math.round(jours)} jours. Un rappel transforme souvent un devis en chantier.`,
    ],
    en: ({ doc, jours }) => [
      `Quote ${doc?.number} unanswered`,
      `${doc?.clientName} hasn't replied in ${Math.round(jours)} days. A reminder often turns a quote into a job.`,
    ],
  },
  compte_inacheve: {
    fr: () => [
      "Votre premier devis en 2 minutes",
      "Votre compte OREN est prêt. Créez un devis pro et envoyez-le sur WhatsApp dans la foulée.",
    ],
    en: () => [
      "Your first quote in 2 minutes",
      "Your OREN account is ready. Create a professional quote and send it over WhatsApp right away.",
    ],
  },
  inactivite: {
    fr: ({ jours }) => [
      "Vos documents vous attendent",
      `Cela fait ${Math.round(jours)} jours. Un devis prêt en 2 minutes, c'est un chantier qui ne vous échappe pas.`,
    ],
    en: ({ jours }) => [
      "Your documents are waiting",
      `It has been ${Math.round(jours)} days. A quote ready in 2 minutes is a job you don't lose.`,
    ],
  },
};

function decision(
  candidat: RelanceCandidate,
  kind: RelanceKind,
  jours: number,
  doc: RelanceDocument | null,
): RelanceDecision {
  const [title, body] = TEXTES[kind][candidat.lang]({
    doc: doc ?? undefined,
    jours,
  });
  return {
    userId: candidat.userId,
    kind,
    documentId: doc?.id ?? null,
    title,
    body,
    url: doc ? `/documents/${doc.id}` : "/accueil",
  };
}

/**
 * Retourne la relance à envoyer, ou `null` s'il ne faut rien envoyer.
 *
 * L'ordre des règles est l'ordre des priorités : l'argent dû d'abord, puis la
 * vente en cours, puis la mise en route, et seulement en dernier le
 * réengagement générique — celui qui n'apporte rien à qui n'a rien à faire.
 */
export function choisirRelance(
  candidat: RelanceCandidate,
  maintenant: Date = new Date(),
): RelanceDecision | null {
  // Un compte suspendu n'a rien à venir consulter : le relancer serait au
  // mieux inutile, au pire vexant.
  if (candidat.companySuspended) return null;

  // Plafond global : au plus MAX_PAR_FENETRE relances sur FENETRE_JOURS,
  // toutes catégories confondues.
  const recents = logsDepuis(candidat.recentLogs, FENETRE_JOURS, maintenant);
  if (recents.length >= MAX_PAR_FENETRE) return null;

  // Une seule relance par jour, quoi qu'il arrive : le cron passe tous les
  // jours et une double exécution ne doit pas se voir chez l'utilisateur.
  if (logsDepuis(candidat.recentLogs, 1, maintenant).length > 0) return null;

  const documentDejaRelance = (id: string) =>
    candidat.recentLogs.some(
      (l) =>
        l.documentId === id &&
        joursDepuis(l.sentAt, maintenant) < DELAI_MEME_DOCUMENT_JOURS,
    );

  const typeDejaRelance = (kind: RelanceKind, jours: number) =>
    candidat.recentLogs.some(
      (l) => l.kind === kind && joursDepuis(l.sentAt, maintenant) < jours,
    );

  // 1. Facture impayée — l'argent déjà gagné mais pas encaissé.
  const factures = candidat.unpaidInvoices.filter(
    (d) =>
      joursDepuis(d.issueDate, maintenant) >= FACTURE_IMPAYEE_JOURS &&
      !documentDejaRelance(d.id),
  );
  const facture = plusAncien(factures);
  if (facture) {
    return decision(
      candidat,
      "facture_impayee",
      joursDepuis(facture.issueDate, maintenant),
      facture,
    );
  }

  // 2. Devis en attente — la vente qui peut encore se conclure.
  const devis = candidat.pendingQuotes.filter(
    (d) =>
      joursDepuis(d.issueDate, maintenant) >= DEVIS_ATTENTE_JOURS &&
      !documentDejaRelance(d.id),
  );
  const devisChoisi = plusAncien(devis);
  if (devisChoisi) {
    return decision(
      candidat,
      "devis_en_attente",
      joursDepuis(devisChoisi.issueDate, maintenant),
      devisChoisi,
    );
  }

  // 3. Compte inachevé — inscrit, mais jamais arrivé au premier document.
  const inacheve = !candidat.hasCompany || candidat.documentsCount === 0;
  const relancesInacheve = candidat.recentLogs.filter(
    (l) => l.kind === "compte_inacheve",
  ).length;
  if (
    inacheve &&
    joursDepuis(candidat.createdAt, maintenant) >= COMPTE_INACHEVE_JOURS &&
    relancesInacheve < MAX_COMPTE_INACHEVE &&
    !typeDejaRelance("compte_inacheve", DELAI_MEME_TYPE_JOURS)
  ) {
    return decision(
      candidat,
      "compte_inacheve",
      joursDepuis(candidat.createdAt, maintenant),
      null,
    );
  }

  // 4. Inactivité — le filet de dernier recours, pour qui a déjà travaillé
  // dans l'application et n'y revient plus.
  const inactifDepuis = candidat.lastSeenAt
    ? joursDepuis(candidat.lastSeenAt, maintenant)
    : joursDepuis(candidat.createdAt, maintenant);
  if (
    !inacheve &&
    inactifDepuis >= INACTIVITE_JOURS &&
    !typeDejaRelance("inactivite", DELAI_MEME_TYPE_JOURS)
  ) {
    return decision(candidat, "inactivite", inactifDepuis, null);
  }

  return null;
}

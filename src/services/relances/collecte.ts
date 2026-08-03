/**
 * Relances push — assemble, à partir des lignes Supabase, les candidats que
 * `choisirRelance` sait juger. Aucune règle métier ici : uniquement du
 * regroupement, pour que la décision reste testable sans base.
 */

import type { Lang } from "@/lib/i18n/config";
import type { RelanceCandidate, RelanceDocument, RelanceLog } from "./types";

export interface LigneProfil {
  id: string;
  created_at: string;
  last_seen_at: string | null;
}

export interface LigneEntreprise {
  id: string;
  owner_id: string;
  suspended_at: string | null;
}

export interface LigneDocument {
  id: string;
  company_id: string;
  type: string;
  status: string;
  number: string;
  client_name: string | null;
  total: number | string;
  issue_date: string;
}

export interface LigneLog {
  user_id: string;
  kind: string;
  document_id: string | null;
  sent_at: string;
}

function versDocument(ligne: LigneDocument): RelanceDocument {
  return {
    id: ligne.id,
    number: ligne.number,
    // Un document peut avoir été créé sans nom de client (saisie express).
    clientName: ligne.client_name?.trim() || "Votre client",
    total: Number(ligne.total) || 0,
    issueDate: ligne.issue_date,
  };
}

/**
 * `langues` vient des abonnements push : c'est la langue de l'appareil au
 * moment où il a accepté les notifications, la seule dont dispose le serveur
 * (il n'a ni cookie ni session pendant le cron).
 */
export function construireCandidats(input: {
  profils: LigneProfil[];
  entreprises: LigneEntreprise[];
  documents: LigneDocument[];
  logs: LigneLog[];
  langues: Map<string, Lang>;
}): RelanceCandidate[] {
  const { profils, entreprises, documents, logs, langues } = input;

  const entrepriseParProprietaire = new Map<string, LigneEntreprise>();
  for (const e of entreprises) entrepriseParProprietaire.set(e.owner_id, e);

  const documentsParEntreprise = new Map<string, LigneDocument[]>();
  for (const d of documents) {
    const liste = documentsParEntreprise.get(d.company_id) ?? [];
    liste.push(d);
    documentsParEntreprise.set(d.company_id, liste);
  }

  const logsParUtilisateur = new Map<string, RelanceLog[]>();
  for (const l of logs) {
    const liste = logsParUtilisateur.get(l.user_id) ?? [];
    liste.push({
      kind: l.kind as RelanceLog["kind"],
      documentId: l.document_id,
      sentAt: l.sent_at,
    });
    logsParUtilisateur.set(l.user_id, liste);
  }

  return profils.map((profil) => {
    const entreprise = entrepriseParProprietaire.get(profil.id);
    const docs = entreprise
      ? (documentsParEntreprise.get(entreprise.id) ?? [])
      : [];

    return {
      userId: profil.id,
      lang: langues.get(profil.id) ?? "fr",
      createdAt: profil.created_at,
      lastSeenAt: profil.last_seen_at,
      hasCompany: Boolean(entreprise),
      companySuspended: Boolean(entreprise?.suspended_at),
      documentsCount: docs.length,
      pendingQuotes: docs
        .filter((d) => d.type === "devis" && d.status === "envoye")
        .map(versDocument),
      // Une facture « envoyée » et jamais passée à « payé » est un impayé :
      // il n'existe pas de date d'échéance dans le schéma, c'est l'âge du
      // document qui fait foi.
      unpaidInvoices: docs
        .filter((d) => d.type === "facture" && d.status === "envoye")
        .map(versDocument),
      recentLogs: logsParUtilisateur.get(profil.id) ?? [],
    };
  });
}

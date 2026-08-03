import { describe, expect, it } from "vitest";
import { choisirRelance } from "./select";
import type { RelanceCandidate, RelanceDocument, RelanceLog } from "./types";

const MAINTENANT = new Date("2026-08-03T08:00:00Z");

function ilYA(jours: number): string {
  return new Date(MAINTENANT.getTime() - jours * 24 * 3600 * 1000).toISOString();
}

function doc(over: Partial<RelanceDocument> = {}): RelanceDocument {
  return {
    id: "doc-1",
    number: "DEV-001",
    clientName: "Mme Ngo",
    total: 250000,
    issueDate: ilYA(10),
    ...over,
  };
}

/** Compte actif « normal » : rien à relancer tant qu'on n'ajoute rien. */
function candidat(over: Partial<RelanceCandidate> = {}): RelanceCandidate {
  return {
    userId: "u-1",
    lang: "fr",
    createdAt: ilYA(120),
    lastSeenAt: ilYA(1),
    hasCompany: true,
    companySuspended: false,
    documentsCount: 12,
    pendingQuotes: [],
    unpaidInvoices: [],
    recentLogs: [],
    ...over,
  };
}

function log(over: Partial<RelanceLog> = {}): RelanceLog {
  return { kind: "inactivite", documentId: null, sentAt: ilYA(1), ...over };
}

describe("choisirRelance — rien à dire, rien à envoyer", () => {
  it("laisse tranquille un compte actif sans document en souffrance", () => {
    expect(choisirRelance(candidat(), MAINTENANT)).toBeNull();
  });

  it("n'envoie rien à une entreprise suspendue, même avec des impayés", () => {
    const c = candidat({
      companySuspended: true,
      unpaidInvoices: [doc({ issueDate: ilYA(60) })],
    });
    expect(choisirRelance(c, MAINTENANT)).toBeNull();
  });
});

describe("choisirRelance — seuils d'ancienneté", () => {
  it("ignore une facture envoyée avant-hier, rappelle celle de la semaine", () => {
    const jeune = candidat({ unpaidInvoices: [doc({ issueDate: ilYA(2) })] });
    expect(choisirRelance(jeune, MAINTENANT)).toBeNull();

    const mure = candidat({ unpaidInvoices: [doc({ issueDate: ilYA(7) })] });
    expect(choisirRelance(mure, MAINTENANT)?.kind).toBe("facture_impayee");
  });

  it("attend 3 jours avant de rappeler un devis sans réponse", () => {
    const jeune = candidat({ pendingQuotes: [doc({ issueDate: ilYA(2) })] });
    expect(choisirRelance(jeune, MAINTENANT)).toBeNull();

    const mur = candidat({ pendingQuotes: [doc({ issueDate: ilYA(3) })] });
    expect(choisirRelance(mur, MAINTENANT)?.kind).toBe("devis_en_attente");
  });

  it("ne relance pour inactivité qu'au bout de 7 jours", () => {
    const recent = candidat({ lastSeenAt: ilYA(6) });
    expect(choisirRelance(recent, MAINTENANT)).toBeNull();

    const absent = candidat({ lastSeenAt: ilYA(7) });
    expect(choisirRelance(absent, MAINTENANT)?.kind).toBe("inactivite");
  });
});

describe("choisirRelance — priorités", () => {
  it("fait passer l'impayé avant le devis et l'inactivité", () => {
    const c = candidat({
      lastSeenAt: ilYA(30),
      unpaidInvoices: [doc({ id: "f-1", number: "FAC-009" })],
      pendingQuotes: [doc({ id: "d-1" })],
    });
    const r = choisirRelance(c, MAINTENANT);
    expect(r?.kind).toBe("facture_impayee");
    expect(r?.documentId).toBe("f-1");
  });

  it("choisit le document le plus ancien quand il y en a plusieurs", () => {
    const c = candidat({
      unpaidInvoices: [
        doc({ id: "f-recent", issueDate: ilYA(8) }),
        doc({ id: "f-vieux", issueDate: ilYA(45) }),
      ],
    });
    expect(choisirRelance(c, MAINTENANT)?.documentId).toBe("f-vieux");
  });

  it("relance la mise en route plutôt que l'inactivité sur un compte vide", () => {
    const c = candidat({
      documentsCount: 0,
      createdAt: ilYA(30),
      lastSeenAt: ilYA(30),
    });
    expect(choisirRelance(c, MAINTENANT)?.kind).toBe("compte_inacheve");
  });
});

describe("choisirRelance — garde-fous anti-harcèlement", () => {
  it("n'envoie jamais deux relances le même jour", () => {
    const c = candidat({
      lastSeenAt: ilYA(30),
      unpaidInvoices: [doc({ id: "f-1" })],
      recentLogs: [log({ sentAt: ilYA(0.5) })],
    });
    expect(choisirRelance(c, MAINTENANT)).toBeNull();
  });

  it("plafonne à 2 relances sur 7 jours glissants", () => {
    const c = candidat({
      unpaidInvoices: [doc({ id: "f-1" })],
      recentLogs: [
        log({ kind: "devis_en_attente", sentAt: ilYA(2) }),
        log({ kind: "inactivite", sentAt: ilYA(5) }),
      ],
    });
    expect(choisirRelance(c, MAINTENANT)).toBeNull();
  });

  it("ne relance pas deux fois le même document dans la quinzaine", () => {
    const dejaVu = candidat({
      unpaidInvoices: [doc({ id: "f-1" })],
      recentLogs: [
        log({ kind: "facture_impayee", documentId: "f-1", sentAt: ilYA(3) }),
      ],
    });
    expect(choisirRelance(dejaVu, MAINTENANT)).toBeNull();

    // Passé le délai, la facture toujours impayée redevient relançable.
    const oublie = candidat({
      unpaidInvoices: [doc({ id: "f-1" })],
      recentLogs: [
        log({ kind: "facture_impayee", documentId: "f-1", sentAt: ilYA(15) }),
      ],
    });
    expect(choisirRelance(oublie, MAINTENANT)?.documentId).toBe("f-1");
  });

  it("abandonne la mise en route après deux tentatives", () => {
    const c = candidat({
      documentsCount: 0,
      createdAt: ilYA(60),
      recentLogs: [
        log({ kind: "compte_inacheve", sentAt: ilYA(30) }),
        log({ kind: "compte_inacheve", sentAt: ilYA(45) }),
      ],
    });
    expect(choisirRelance(c, MAINTENANT)).toBeNull();
  });

  it("espace deux relances d'inactivité d'au moins 14 jours", () => {
    const c = candidat({
      lastSeenAt: ilYA(30),
      recentLogs: [log({ kind: "inactivite", sentAt: ilYA(10) })],
    });
    expect(choisirRelance(c, MAINTENANT)).toBeNull();
  });
});

describe("choisirRelance — contenu de la notification", () => {
  it("nomme le client, le montant et la destination", () => {
    const c = candidat({
      unpaidInvoices: [
        doc({
          id: "f-1",
          number: "FAC-042",
          clientName: "M. Fotso",
          total: 1250000,
          issueDate: ilYA(12),
        }),
      ],
    });
    const r = choisirRelance(c, MAINTENANT);
    expect(r?.title).toContain("FAC-042");
    expect(r?.body).toContain("M. Fotso");
    expect(r?.body).toContain("1 250 000 FCFA");
    expect(r?.body).toContain("12 jours");
    expect(r?.url).toBe("/documents/f-1");
  });

  it("écrit en anglais aux comptes anglophones", () => {
    const c = candidat({ lang: "en", lastSeenAt: ilYA(20) });
    const r = choisirRelance(c, MAINTENANT);
    expect(r?.title).toBe("Your documents are waiting");
    expect(r?.url).toBe("/accueil");
  });

  it("renvoie vers l'accueil quand aucun document n'est en jeu", () => {
    const c = candidat({ documentsCount: 0, createdAt: ilYA(10) });
    expect(choisirRelance(c, MAINTENANT)?.url).toBe("/accueil");
  });
});

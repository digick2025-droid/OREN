import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELAI_JOURS,
  MAX_PROPOSITIONS,
  noterProposition,
  peutProposer,
} from "./push-invite";
import { lirePushStatus } from "./push";

vi.mock("./push", () => ({ lirePushStatus: vi.fn() }));

const statut = vi.mocked(lirePushStatus);

/** localStorage minimal : l'environnement de test est `node`. */
function installerStockage(): Map<string, string> {
  const donnees = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (c: string) => donnees.get(c) ?? null,
    setItem: (c: string, v: string) => void donnees.set(c, v),
  });
  return donnees;
}

const JOUR_MS = 24 * 3600 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  installerStockage();
  statut.mockResolvedValue("inactif");
});

describe("peutProposer — à qui l'on propose", () => {
  it("propose à un appareil capable et pas encore abonné", async () => {
    await expect(peutProposer()).resolves.toBe(true);
  });

  it("ne propose rien à un appareil déjà abonné", async () => {
    statut.mockResolvedValue("actif");
    await expect(peutProposer()).resolves.toBe(false);
  });

  it("ne propose rien après un refus au navigateur, qui est définitif", async () => {
    statut.mockResolvedValue("refuse");
    await expect(peutProposer()).resolves.toBe(false);
  });

  it("ne propose rien là où le push n'existe pas", async () => {
    statut.mockResolvedValue("indisponible");
    await expect(peutProposer()).resolves.toBe(false);
  });
});

describe("peutProposer — ne jamais insister", () => {
  it("n'enchaîne pas deux propositions le même jour", async () => {
    noterProposition();
    await expect(peutProposer()).resolves.toBe(false);
  });

  it("laisse repasser une proposition après le délai", async () => {
    noterProposition();
    vi.setSystemTime(new Date(Date.now() + (DELAI_JOURS + 1) * JOUR_MS));
    await expect(peutProposer()).resolves.toBe(true);
    vi.useRealTimers();
  });

  it("abandonne après MAX_PROPOSITIONS, même longtemps après", async () => {
    for (let i = 0; i < MAX_PROPOSITIONS; i += 1) {
      noterProposition();
      vi.setSystemTime(new Date(Date.now() + (DELAI_JOURS + 1) * JOUR_MS));
    }
    await expect(peutProposer()).resolves.toBe(false);

    vi.setSystemTime(new Date(Date.now() + 365 * JOUR_MS));
    await expect(peutProposer()).resolves.toBe(false);
    vi.useRealTimers();
  });
});

describe("peutProposer — stockage indisponible", () => {
  it("propose quand même si localStorage lève (navigation privée)", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    });
    // Mieux vaut reproposer que ne jamais proposer : le plafond du navigateur,
    // lui, reste infranchissable.
    expect(() => noterProposition()).not.toThrow();
    await expect(peutProposer()).resolves.toBe(true);
  });
});

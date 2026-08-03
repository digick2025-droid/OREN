import { describe, expect, it } from "vitest";
import { isPublic } from "./middleware";

/**
 * Le middleware redirige vers /connexion tout ce qui n'est pas déclaré public.
 *
 * Pour une page, l'oubli se voit tout de suite. Pour un callback de
 * passerelle, non : la passerelle reçoit une redirection, considère la
 * notification comme distribuée, et le paiement encaissé n'est jamais
 * confirmé. C'est une panne silencieuse — d'où ces tests.
 */
describe("isPublic — callbacks de paiement", () => {
  it("laisse passer les webhooks des passerelles", () => {
    // Chemins réellement appelés par K-PAY (imposés par leur tableau de bord).
    expect(isPublic("/api/webhooks/deposits")).toBe(true);
    expect(isPublic("/api/webhooks/kpay")).toBe(true);
    // Chemin canonique + webhook CamerPay, sous /api/payments.
    expect(isPublic("/api/payments/webhook/kpay")).toBe(true);
    expect(isPublic("/api/payments/webhook")).toBe(true);
  });

  it("laisse passer le parcours de paiement anonyme", () => {
    // Un payeur express n'a pas de compte : ni session, ni redirection.
    expect(isPublic("/api/payments")).toBe(true);
    expect(isPublic("/api/payments/status")).toBe(true);
    expect(isPublic("/express")).toBe(true);
    expect(isPublic("/paiement/retour")).toBe(true);
  });

  it("protège toujours le reste de l'application", () => {
    expect(isPublic("/accueil")).toBe(false);
    expect(isPublic("/documents")).toBe(false);
    expect(isPublic("/admin")).toBe(false);
    expect(isPublic("/api/webhooks-truques")).toBe(false);
    // Le préfixe ne doit pas ouvrir une route voisine par accident.
    expect(isPublic("/expressions")).toBe(false);
  });
});

/**
 * Le mode hors-ligne dépend entièrement de ces deux routes. Redirigées vers
 * /connexion, le navigateur reçoit du text/html là où il attend un script :
 * l'enregistrement du service worker échoue et l'application n'a plus aucun
 * hors-ligne — sans le moindre message d'erreur visible.
 */
describe("isPublic — service worker et repli hors-ligne", () => {
  it("sert le service worker sans session", () => {
    expect(isPublic("/sw.js")).toBe(true);
  });

  it("sert la page de repli hors-ligne sans session", () => {
    // Elle doit pouvoir être préchargée par un visiteur déconnecté.
    expect(isPublic("/hors-ligne.html")).toBe(true);
  });

  it("laisse le manifeste public", () => {
    expect(isPublic("/manifest.webmanifest")).toBe(true);
  });
});

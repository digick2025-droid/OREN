import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ACCOUNT_COOKIE, isPublic, shouldSkipLanding } from "./middleware";

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

/**
 * Le cron Vercel appelle sans session. Redirigé vers /connexion, il renvoie un
 * 200 en HTML : Vercel considère la tâche réussie et plus aucune relance ne
 * part — la panne la plus discrète qui soit.
 */
describe("isPublic — tâches planifiées", () => {
  it("laisse passer le cron des relances", () => {
    expect(isPublic("/api/cron/relances")).toBe(true);
  });

  it("garde les routes d'abonnement push derrière la session", () => {
    // Elles écrivent au nom de l'utilisateur connecté : jamais publiques.
    expect(isPublic("/api/push/subscribe")).toBe(false);
    expect(isPublic("/api/push/unsubscribe")).toBe(false);
  });
});

/**
 * Un détenteur de compte ne doit plus retomber sur la vitrine : il va à
 * l'app, donc à /connexion si sa session a expiré. Mais un clic interne vers
 * « / » (lien retour de /connexion) doit toujours afficher la vitrine.
 */
describe("shouldSkipLanding — détenteur de compte sur la vitrine", () => {
  const req = (path: string, headers: Record<string, string> = {}) =>
    new NextRequest(`https://oren.app${path}`, { headers });
  const compte = { cookie: `${ACCOUNT_COOKIE}=1` };

  it("envoie à l'app un détenteur de compte arrivé de l'extérieur", () => {
    expect(shouldSkipLanding(req("/", { ...compte, "sec-fetch-site": "none" }))).toBe(true);
    expect(shouldSkipLanding(req("/", { ...compte, "sec-fetch-site": "cross-site" }))).toBe(true);
    // Navigateur sans Sec-Fetch-Site ni référent : adresse tapée.
    expect(shouldSkipLanding(req("/", compte))).toBe(true);
  });

  it("montre la vitrine sur un clic interne", () => {
    expect(shouldSkipLanding(req("/", { ...compte, "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(
      shouldSkipLanding(req("/", { ...compte, referer: "https://oren.app/connexion" })),
    ).toBe(false);
  });

  it("montre la vitrine à un nouveau visiteur", () => {
    expect(shouldSkipLanding(req("/", { "sec-fetch-site": "none" }))).toBe(false);
  });

  it("ne touche qu'à la vitrine", () => {
    expect(shouldSkipLanding(req("/offres", { ...compte, "sec-fetch-site": "none" }))).toBe(false);
    expect(shouldSkipLanding(req("/express", { ...compte, "sec-fetch-site": "none" }))).toBe(false);
  });
});

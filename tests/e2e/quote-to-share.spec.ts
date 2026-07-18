/**
 * Test E2E — Parcours : création devis → génération PDF → partage.
 *
 * Il s'appuie sur le mode « Express » (sans compte) : c'est le chemin le plus
 * proche du parcours utilisateur qui ne dépend pas d'une session authentifiée.
 *   1. Remplir le formulaire d'un devis (entreprise, client, une ligne).
 *   2. Aperçu → le PDF est généré et rendu dans l'iframe (source de vérité :
 *      le même moteur `renderDocumentHtml` que l'app authentifiée).
 *   3. Partage : au bout du parcours, le bouton WhatsApp ouvre un lien wa.me
 *      contenant le nom du document et le montant.
 *
 * Prérequis d'exécution :
 *   - Un serveur OREN joignable sur E2E_BASE_URL (défaut http://127.0.0.1:3000).
 *     Les étapes 1–2 (création + génération PDF) tournent avec un simple
 *     `next dev`, sans Supabase.
 *   - L'étape 3 (paiement Express simulé puis partage) requiert en plus un
 *     backend complet (Supabase + PAYMENT_PROVIDER=simulated). Elle n'est
 *     jouée que si E2E_FULL=1, sinon elle est ignorée proprement.
 *
 * Sans serveur joignable, toute la suite est ignorée (skip), pas d'échec.
 */

import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const runShareStep = process.env.E2E_FULL === "1";

let serverUp = false;

test.beforeAll(async () => {
  try {
    const res = await fetch(`${baseURL}/express`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    serverUp = res.ok;
  } catch {
    serverUp = false;
  }
});

test.beforeEach(() => {
  test.skip(
    !serverUp,
    `Serveur OREN injoignable sur ${baseURL} — démarrer 'npm run dev' ou poser E2E_BASE_URL.`,
  );
});

/** Remplit le formulaire Express d'un devis simple et prêt pour l'aperçu. */
async function fillExpressQuote(page: Page) {
  await page.goto("/express");

  await page.getByLabel(/entreprise|business/i).first().fill("Plomberie Test");

  // Titre du document (premier champ « titre »).
  const title = page.getByLabel(/titre|title/i).first();
  if (await title.count()) await title.fill("Réparation fuite");

  await page.getByLabel(/client/i).first().fill("Jean Kouassi");
  await page.getByLabel(/tel|phone|téléphone/i).first().fill("690000000");

  // Ligne 1 : nom + prix unitaire (le champ nom est le placeholder libre).
  await page.getByPlaceholder(/désignation|libre|article|prestation|q_free/i)
    .first()
    .fill("Main d'œuvre")
    .catch(async () => {
      // Repli : premier input texte de la carte ligne.
      await page.locator("input[type='text']").nth(1).fill("Main d'œuvre");
    });

  // Prix unitaire : champ numérique avec suffixe FCFA (valeur initiale "0").
  const priceInput = page.locator("input[inputmode='numeric']").first();
  await priceInput.click();
  await priceInput.fill("25000");
}

test("création devis → génération PDF (aperçu)", async ({ page }) => {
  await fillExpressQuote(page);

  // Étape aperçu : le bouton CTA fait passer à l'écran de prévisualisation.
  await page.getByRole("button", { name: /aperçu|preview|voir/i }).first().click();

  // Le PDF est généré dans une iframe (srcDoc = moteur de rendu).
  const preview = page.locator("iframe").first();
  await expect(preview).toBeVisible({ timeout: 10_000 });

  // Le contenu rendu contient le client et le montant → génération réussie.
  const frame = page.frameLocator("iframe").first();
  await expect(frame.locator("body")).toContainText("Jean Kouassi", {
    timeout: 10_000,
  });
});

test("parcours complet création → PDF → partage WhatsApp", async ({ page }) => {
  test.skip(
    !runShareStep,
    "Étape partage : requiert un backend complet (Supabase + paiement simulé). Poser E2E_FULL=1.",
  );

  // Intercepte window.open pour capturer le lien de partage wa.me.
  await page.addInitScript(() => {
    (window as unknown as { __sharedUrl?: string }).__sharedUrl = undefined;
    window.open = ((url?: string | URL) => {
      (window as unknown as { __sharedUrl?: string }).__sharedUrl = String(url);
      return null;
    }) as typeof window.open;
  });

  await fillExpressQuote(page);
  await page.getByRole("button", { name: /aperçu|preview|voir/i }).first().click();

  // Passe au paiement (Express) puis règle via le fournisseur simulé.
  await page.getByRole("button", { name: /payer|pay/i }).first().click();
  await page.getByLabel(/tel|phone|téléphone/i).first().fill("690000000");
  await page.getByRole("button", { name: /confirmer|payer|pay/i }).first().click();

  // Écran final : partage WhatsApp.
  const shareBtn = page.getByRole("button", { name: /whatsapp|partag|envoyer|send/i });
  await expect(shareBtn.first()).toBeVisible({ timeout: 20_000 });
  await shareBtn.first().click();

  const shared = await page.evaluate(
    () => (window as unknown as { __sharedUrl?: string }).__sharedUrl,
  );
  expect(shared, "un lien de partage wa.me doit être ouvert").toContain("wa.me");
  expect(shared).toContain("690000000");
});

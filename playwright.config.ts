import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright — tests E2E du parcours OREN.
 *
 * Les specs vivent dans `tests/e2e/**.spec.ts` (les tests unitaires/intégration
 * Vitest sont en `*.test.ts` et ne sont jamais ramassés par Playwright).
 *
 * L'app doit tourner sur `E2E_BASE_URL` (défaut http://127.0.0.1:3000).
 * Deux façons de fournir le serveur :
 *   1. Le lancer soi-même (`npm run dev`) puis `npx playwright test`.
 *   2. Poser `E2E_START_SERVER=1` pour que Playwright démarre `next dev`
 *      (nécessite un .env.local Supabase valide).
 *
 * Sans serveur joignable, les specs se désactivent proprement (voir le
 * beforeAll de tests/e2e/quote-to-share.spec.ts) plutôt que d'échouer.
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(process.env.E2E_START_SERVER
    ? {
        webServer: {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Tests unitaires (src) + intégration Supabase (tests/**).
    // Les specs Playwright sont en `*.spec.ts` sous tests/e2e et ne sont
    // jamais ramassées par Vitest.
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "tests/e2e/**"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `getSiteUrl` lit process.env au moment de l'appel, mais le module est mis en
 * cache par l'import : on le réimporte à chaque cas pour repartir propre.
 */
async function getSiteUrl() {
  vi.resetModules();
  return (await import("./site-url")).getSiteUrl();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSiteUrl", () => {
  it("utilise NEXT_PUBLIC_SITE_URL quand elle est définie", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://oren.app");
    vi.stubEnv("VERCEL_URL", "oren-abc123-digick.vercel.app");
    expect(await getSiteUrl()).toBe("https://oren.app");
  });

  it("retombe sur VERCEL_URL et lui ajoute le protocole", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "oren-abc123-digick.vercel.app");
    expect(await getSiteUrl()).toBe("https://oren-abc123-digick.vercel.app");
  });

  it("retombe sur l'URL par défaut sans aucune variable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(await getSiteUrl()).toBe("https://oren.app");
  });

  it("retire le slash final", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://oren.app/");
    expect(await getSiteUrl()).toBe("https://oren.app");
  });

  it("préserve un protocole déjà présent, y compris http", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(await getSiteUrl()).toBe("http://localhost:3000");
  });

  it("ignore une valeur qui n'est que des espaces", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "   ");
    vi.stubEnv("VERCEL_URL", "oren-abc123-digick.vercel.app");
    expect(await getSiteUrl()).toBe("https://oren-abc123-digick.vercel.app");
  });
});

import type { MetadataRoute } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";

/**
 * Un robots.txt erroné en production désindexerait tout le site : le
 * comportement mérite d'être verrouillé plutôt que relu à l'œil.
 */

/** `rules` est un objet OU un tableau : on en extrait la première règle. */
function firstRule(result: MetadataRoute.Robots) {
  const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  if (!rule) throw new Error("robots() n'a renvoyé aucune règle");
  return rule;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots", () => {
  it("interdit tout hors production (preview Vercel)", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const rules = robots().rules;
    expect(rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("interdit tout en local, où VERCEL_ENV est absente", () => {
    vi.stubEnv("VERCEL_ENV", "");
    const rules = robots().rules;
    expect(rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("autorise l'indexation en production et expose le sitemap", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://oren-two.vercel.app");

    const result = robots();
    const rule = firstRule(result);

    expect(rule.allow).toBe("/");
    expect(result.sitemap).toBe("https://oren-two.vercel.app/sitemap.xml");
    expect(result.host).toBe("https://oren-two.vercel.app");
  });

  it("garde les espaces authentifiés hors indexation en production", () => {
    vi.stubEnv("VERCEL_ENV", "production");

    const disallow = firstRule(robots()).disallow as string[];

    // Les pages derrière authentification ne doivent jamais fuiter en SERP.
    for (const path of ["/documents", "/clients", "/reglages", "/api/"]) {
      expect(disallow).toContain(path);
    }
  });
});

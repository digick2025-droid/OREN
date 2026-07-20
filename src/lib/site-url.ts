/**
 * URL publique du site, résolue dans cet ordre :
 *
 * 1. `NEXT_PUBLIC_SITE_URL` — valeur explicite, pour le domaine définitif en
 *    production ;
 * 2. `VERCEL_URL` — URL propre au déploiement, injectée automatiquement par
 *    Vercel. C'est elle qui donne aux **previews** leur vraie URL : sans ça
 *    chaque preview annonçait le repli de production dans son canonical, son
 *    Open Graph et son sitemap, en pointant donc vers un autre site que
 *    celui réellement servi ;
 * 3. repli codé en dur, pour les environnements sans aucune variable
 *    (dev local, CI).
 *
 * `VERCEL_URL` n'est lisible que **côté serveur** (ce n'est pas une variable
 * `NEXT_PUBLIC_*`). Les seuls appelants — metadata du layout, sitemap,
 * robots — sont des modules serveur, donc la valeur est bien résolue.
 */

const FALLBACK_SITE_URL = "https://oren.app";

/** Ajoute le protocole si absent (VERCEL_URL est un hôte nu) et retire le / final. */
function normalize(url: string): string {
  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return withProtocol.replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalize(explicit);

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return normalize(deployment);

  return FALLBACK_SITE_URL;
}

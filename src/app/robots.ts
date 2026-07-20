import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  // Hors production (previews Vercel, dev local), on interdit tout : une
  // preview est publiquement accessible et servirait le même contenu que le
  // site réel — donc du contenu dupliqué, sur une URL éphémère. Vercel pose
  // déjà un en-tête `X-Robots-Tag: noindex` sur ces déploiements ; ceci en
  // est la ceinture, l'en-tête étant les bretelles.
  // NB : `VERCEL_ENV` est absente en local, ce qui range bien le dev ici.
  if (process.env.VERCEL_ENV !== "production") {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Espaces privés / authentifiés et pages internes : hors indexation.
        disallow: [
          "/api/",
          "/accueil",
          "/bienvenue",
          "/catalogue",
          "/clients",
          "/documents",
          "/nouveau",
          "/abonnement",
          "/paiement",
          "/entreprise",
          "/reglages",
          "/connexion",
          "/design-system",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

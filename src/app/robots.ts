import type { MetadataRoute } from "next";

// URL publique du site — surchargeable via NEXT_PUBLIC_SITE_URL,
// avec un repli raisonnable pour les environnements sans variable.
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://oren.app").replace(
  /\/$/,
  "",
);

export default function robots(): MetadataRoute.Robots {
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

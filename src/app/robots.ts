import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

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

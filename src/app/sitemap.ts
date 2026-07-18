import type { MetadataRoute } from "next";

// URL publique du site — surchargeable via NEXT_PUBLIC_SITE_URL,
// avec un repli raisonnable pour les environnements sans variable.
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://oren.app").replace(
  /\/$/,
  "",
);

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/offres`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/express`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}

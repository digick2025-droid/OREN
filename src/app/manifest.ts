import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OREN — Gérez votre activité",
    short_name: "OREN",
    description:
      "Concentrez-vous sur votre métier. OREN s'occupe du reste. Devis et factures pros en quelques secondes.",
    start_url: "/",
    display: "standalone",
    // Cohérent avec le themeColor sombre déclaré dans layout.tsx (viewport).
    background_color: "#FFFFFF",
    theme_color: "#0A0F1C",
    lang: "fr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

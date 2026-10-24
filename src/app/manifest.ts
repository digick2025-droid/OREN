import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OREN — Gérez votre activité",
    short_name: "OREN",
    description:
      "Concentrez-vous sur votre métier. OREN s'occupe du reste. Devis et factures pros en quelques secondes.",
    // L'application installée démarre sur l'app, pas sur la page vitrine :
    // hors ligne, "/" ne mène nulle part d'utile pour un utilisateur connecté.
    start_url: "/accueil",
    // Identité de l'app installée. Valeur identique à celle que Chrome
    // déduisait de start_url : les installations existantes restent la même
    // app. Ne plus jamais la changer, sinon Android voit une nouvelle app.
    id: "/accueil",
    scope: "/",
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
      // Icône d'app Android (lanceur + écran de lancement). Fond plein sans
      // coins transparents, glyphe réduit dans la zone sûre : l'icône 512
      // « any » recadrée par le masque laissait un logo qui remplissait tout.
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

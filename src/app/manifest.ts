import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DIGICK Devis",
    short_name: "DIGICK",
    description:
      "Créez un devis professionnel en moins de 2 minutes et envoyez-le sur WhatsApp.",
    start_url: "/",
    display: "standalone",
    background_color: "#131F35",
    theme_color: "#131F35",
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

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/config";
import { THEME_COOKIE, parseTheme } from "@/lib/theme/config";
import { getSiteUrl } from "@/lib/site-url";
import { InstallPrompt } from "@/components/install-prompt";
import { OfflineBanner } from "@/components/offline-banner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = getSiteUrl();

const siteTitle = "OREN — Gérez votre activité, simplement";
const siteDescription =
  "Concentrez-vous sur votre métier. OREN s'occupe du reste. Devis et factures professionnels en quelques secondes.";

// Image de partage. À remplacer par un visuel 1200×630 dédié (public/og.png)
// dès qu'il sera disponible ; on réutilise l'icône 512 pour éviter un 404.
const ogImage = {
  url: "/icons/icon-512.png",
  width: 512,
  height: 512,
  alt: "OREN",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s · OREN",
  },
  description: siteDescription,
  applicationName: "OREN",
  keywords: [
    "devis",
    "facture",
    "facturation",
    "gestion d'activité",
    "auto-entrepreneur",
    "artisan",
    "PME",
    "OREN",
  ],
  authors: [{ name: "OREN" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "OREN",
    title: siteTitle,
    description: siteDescription,
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [ogImage.url],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OREN",
    // Splash screen iOS (rel="apple-touch-startup-image"). Visuel dédié par
    // gabarit à ajouter plus tard ; l'icône 512 sert de repli centré.
    startupImage: [{ url: "/icons/icon-512.png" }],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0F1C" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Script bloquant : applique la classe `dark` avant le premier paint pour
// éviter tout flash (nécessaire car `system` n'est pas connu du SSR).
const THEME_INIT_SCRIPT = `
(function(){try{
  var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]+)/);
  var t=m?m[1]:"system";
  var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  var r=document.documentElement;
  if(d)r.classList.add("dark");
  r.style.colorScheme=d?"dark":"light";
}catch(e){}})();
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const lang = parseLang(cookieStore.get(LANG_COOKIE)?.value);
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html lang={lang} className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <Providers initialLang={lang} initialTheme={theme}>
          <OfflineBanner />
          {children}
          <InstallPrompt />
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}

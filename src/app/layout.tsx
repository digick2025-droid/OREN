import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/config";
import { THEME_COOKIE, parseTheme } from "@/lib/theme/config";
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

export const metadata: Metadata = {
  title: "OREN — Gérez votre activité, simplement",
  description:
    "Concentrez-vous sur votre métier. OREN s'occupe du reste. Devis et factures professionnels en quelques secondes.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OREN",
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

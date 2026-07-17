import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { cookies } from "next/headers";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/config";
import { InstallPrompt } from "@/components/install-prompt";
import { OfflineBanner } from "@/components/offline-banner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { Providers } from "./providers";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "DIGICK Devis",
  description:
    "Créez un devis professionnel en moins de 2 minutes et envoyez-le sur WhatsApp.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DIGICK",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#131F35",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const lang = parseLang(cookieStore.get(LANG_COOKIE)?.value);

  return (
    <html lang={lang}>
      <body className={`${poppins.variable} font-sans`}>
        <Providers initialLang={lang}>
          <OfflineBanner />
          {children}
          <InstallPrompt />
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}

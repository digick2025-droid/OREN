"use client";

import { useEffect } from "react";
import { Inter } from "next/font/google";
import { AlertTriangle, RotateCw } from "lucide-react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Le global-error remplace le layout racine : il doit rendre son propre
// <html>/<body> et ré-appliquer la classe `dark` avant le premier paint.
const THEME_INIT_SCRIPT = `
(function(){try{
  var m=document.cookie.match(/(?:^|; )oren_theme=([^;]+)/);
  var t=m?m[1]:"system";
  var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  var r=document.documentElement;
  if(d)r.classList.add("dark");
  r.style.colorScheme=d?"dark":"light";
}catch(e){}})();
`;

/**
 * OREN · Global error boundary.
 * Dernier filet de sécurité : capture les erreurs survenant dans le layout racine.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[oren] global boundary:", error);
  }, [error]);

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-surface px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error-surface text-error">
            <AlertTriangle size={28} />
          </div>

          <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.18em] text-accent">
            Oups
          </p>
          <h1 className="mt-2 text-[24px] font-extrabold text-navy">
            Une erreur critique est survenue
          </h1>
          <p className="mt-2 max-w-xs text-[14px] text-muted-foreground">
            L&apos;application a rencontré un problème inattendu. Réessayez pour
            recharger.
          </p>

          {error.digest && (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground/60">
              Réf. {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={() => reset()}
            className="mt-8 inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-accent-foreground transition-transform active:scale-[.985]"
          >
            <RotateCw size={18} /> Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}

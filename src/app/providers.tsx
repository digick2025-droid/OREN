"use client";

import {
  dehydrate,
  hydrate,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { LanguageProvider } from "@/features/i18n/language-context";
import type { Lang } from "@/lib/i18n/config";

const CACHE_KEY = "digick_rq_cache";

export function Providers({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Les données restent affichées depuis le cache pendant la
            // navigation ; rafraîchies en arrière-plan au-delà de 5 min.
            staleTime: 5 * 60_000,
            gcTime: 24 * 60 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  // Persistance légère du cache (consultation hors-ligne, sans dépendance).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) hydrate(queryClient, JSON.parse(raw));
    } catch {
      // cache illisible : on repart propre
    }

    const persist = () => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(dehydrate(queryClient)));
      } catch {
        // quota plein : sans gravité
      }
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      persist();
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider initialLang={initialLang}>
        {children}
        <Toaster position="bottom-center" richColors />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

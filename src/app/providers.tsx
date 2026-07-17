"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { LanguageProvider } from "@/features/i18n/language-context";
import type { Lang } from "@/lib/i18n/config";

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
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider initialLang={initialLang}>
        {children}
        <Toaster position="bottom-center" richColors />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

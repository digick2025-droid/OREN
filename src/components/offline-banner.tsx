"use client";

import { WifiOff } from "lucide-react";
import { useI18n } from "@/features/i18n/language-context";
import { useOnline } from "@/hooks/use-online";

/** Bandeau discret affiché lorsque l'appareil est hors connexion. */
export function OfflineBanner() {
  const { t } = useI18n();
  const online = useOnline();

  if (online) return null;

  return (
    <div className="fixed left-1/2 top-0 z-[60] flex w-full max-w-md -translate-x-1/2 items-center justify-center gap-2 bg-brand-navy py-1.5 text-[12px] font-semibold text-white">
      <WifiOff size={13} /> {t.offline_notice}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/features/i18n/language-context";

/** Bandeau discret affiché lorsque l'appareil est hors connexion. */
export function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed left-1/2 top-0 z-[60] flex w-full max-w-md -translate-x-1/2 items-center justify-center gap-2 bg-brand-navy py-1.5 text-[12px] font-semibold text-white">
      <WifiOff size={13} /> {t.offline_notice}
    </div>
  );
}

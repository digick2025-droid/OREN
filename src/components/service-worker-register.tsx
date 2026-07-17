"use client";

import { useEffect } from "react";

/** Enregistre le service worker (hors-ligne) en production uniquement. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // enregistrement échoué : l'app fonctionne quand même en ligne
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}

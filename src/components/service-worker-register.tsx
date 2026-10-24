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
    // L'hydratation peut finir après `load` (scripts asynchrones, réseau
    // lent) : l'écouter seulement laissait l'appareil sans worker, donc sans
    // aucun mode hors-ligne.
    if (document.readyState === "complete") {
      onLoad();
      return;
    }
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}

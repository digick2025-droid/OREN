"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * État réseau signalé par le navigateur. `true` côté serveur : le rendu
 * initial est celui d'un appareil connecté, corrigé à l'hydratation.
 *
 * `navigator.onLine` peut mentir dans un sens (connecté à un Wi-Fi sans
 * internet) : un `true` ne garantit pas que la requête passera, d'où le
 * repli sur la boîte d'envoi quand l'envoi échoue sur une erreur réseau.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

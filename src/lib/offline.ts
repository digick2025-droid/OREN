import { clearOutbox, readOutbox } from "./outbox";

/** Clé du cache React Query persisté (consultation hors-ligne). */
export const RQ_CACHE_KEY = "digick_rq_cache";

/**
 * Vide tout ce que l'appareil garde de la session : pages HTML nominatives
 * dans le cache du service worker, données Supabase dans le cache React
 * Query persisté, et documents créés hors-ligne pas encore envoyés (l'appelant
 * demande confirmation avant, voir `confirmSignOut`).
 *
 * À appeler à chaque déconnexion. Sans cela, le compte suivant sur le même
 * appareil voit les documents du précédent dès qu'il passe hors ligne — les
 * deux caches survivent au `signOut()` de Supabase, qui ne connaît que ses
 * propres jetons.
 */
export async function clearOfflineData(): Promise<void> {
  clearOutbox();
  try {
    localStorage.removeItem(RQ_CACHE_KEY);
  } catch {
    // stockage indisponible (navigation privée) : rien à purger
  }

  // On supprime les caches depuis la page, sans passer par le service worker :
  // `serviceWorker.ready` ne se résout jamais tant qu'aucun worker n'est
  // enregistré (développement, premier chargement, navigation privée), et la
  // déconnexion resterait bloquée sur ce `await`.
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // Cache Storage indisponible : il n'y a rien de stocké à purger
  }
}

/**
 * Avant une déconnexion : les documents créés hors-ligne et pas encore
 * envoyés seraient perdus (la boîte d'envoi est vidée avec le reste). On le
 * dit, et l'utilisateur peut rester connecté le temps que le réseau revienne.
 *
 * `message` contient `{n}`, remplacé par le nombre de documents en attente.
 */
export function confirmSignOut(message: string): boolean {
  const pending = readOutbox().length;
  if (pending === 0) return true;
  return window.confirm(message.replace("{n}", String(pending)));
}

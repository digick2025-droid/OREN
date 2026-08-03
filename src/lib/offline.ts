/** Clé du cache React Query persisté (consultation hors-ligne). */
export const RQ_CACHE_KEY = "digick_rq_cache";

/**
 * Vide tout ce que l'appareil garde de la session : pages HTML nominatives
 * dans le cache du service worker, et données Supabase dans le cache React
 * Query persisté.
 *
 * À appeler à chaque déconnexion. Sans cela, le compte suivant sur le même
 * appareil voit les documents du précédent dès qu'il passe hors ligne — les
 * deux caches survivent au `signOut()` de Supabase, qui ne connaît que ses
 * propres jetons.
 */
export async function clearOfflineData(): Promise<void> {
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

/*
 * Service worker OREN — hors-ligne « consultation + brouillons ».
 * - Statiques (_next/static, icônes) : cache-first.
 * - Navigations : network-first, repli sur la page en cache puis sur OFFLINE_URL.
 * - Supabase / API : jamais mis en cache (données authentifiées, temps réel).
 *
 * Deux règles non négociables, chacune a déjà cassé le mode hors-ligne :
 *  1. On ne met JAMAIS en cache une réponse redirigée. Sans session, le
 *     middleware renvoie /connexion : on stockait la page de connexion sous la
 *     clé /accueil, et tout le hors-ligne affichait le formulaire de login.
 *  2. On précharge un par un, jamais avec addAll : addAll est atomique, une
 *     seule URL en échec vidait tout le préchargement — en silence.
 */
const CACHE = "oren-v3";
/* Fichier statique, pas une route Next : servi sous l'URL demandée, une page
 * du routeur hydrate une charge RSC qui ne correspond pas à l'URL et l'error
 * boundary affiche « Une erreur est survenue » à la place du repli. */
const OFFLINE_URL = "/hors-ligne.html";

/* Uniquement des ressources publiques : le SW peut s'installer déconnecté. */
const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/** Une réponse personnalisée, redirigée ou en erreur n'a rien à faire en cache. */
function isCacheable(response) {
  return Boolean(
    response &&
      response.ok &&
      !response.redirected &&
      response.type === "basic",
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          fetch(url, { credentials: "same-origin" })
            .then((res) => (isCacheable(res) ? cache.put(url, res) : undefined))
            .catch(() => undefined),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

/* La purge à la déconnexion (pages HTML nominatives : elles ne doivent pas
 * survivre au changement de compte) est faite par la page elle-même, dans
 * `src/lib/offline.ts` — Cache Storage est accessible des deux côtés, et la
 * page n'a alors pas besoin qu'un worker soit actif pour se nettoyer. */

/* ------------------------------------------------------------------
 * Relances push
 * ------------------------------------------------------------------ */

/* Un `push` reçu DOIT afficher une notification : les navigateurs révoquent
 * la permission d'une application qui reçoit des push silencieux. En cas de
 * charge utile illisible, on affiche donc un message générique plutôt que rien. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "OREN";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    lang: data.lang || "fr",
    /* Une relance chasse la précédente : deux rappels empilés dans le tiroir
     * de notifications se lisent comme du harcèlement. */
    tag: "oren-relance",
    renotify: true,
    data: { url: data.url || "/accueil" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* Au clic : reprendre l'onglet OREN déjà ouvert plutôt que d'en empiler un
 * nouveau — sur mobile, ouvrir un second onglet fait perdre le brouillon en
 * cours de saisie dans le premier. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = (event.notification.data && event.notification.data.url) || "/accueil";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsList) => {
        for (const client of clientsList) {
          if (new URL(client.url).origin === self.location.origin) {
            return client.focus().then((c) => (c && c.navigate ? c.navigate(cible) : c));
          }
        }
        return self.clients.openWindow(cible);
      }),
  );
});

function isCacheableStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

/* Charges RSC des navigations client (<Link>) : l'URL porte un hash de build,
 * la mettre en cache sert un arbre périmé. On laisse l'échec remonter — Next
 * bascule alors sur une navigation complète, que l'on sait servir. */
function isRscRequest(request, url) {
  return url.searchParams.has("_rsc") || request.headers.get("RSC") === "1";
}

/* Le repli hors-ligne se reconstitue tout seul : la déconnexion vide tous les
 * caches, et l'install du worker ne rejoue qu'au déploiement suivant. Sans ce
 * rattrapage, l'appareil passerait des semaines sans page de repli. */
function ensureOfflineFallback(cache) {
  return cache.match(OFFLINE_URL).then((cached) => {
    if (cached) return undefined;
    return fetch(OFFLINE_URL, { credentials: "same-origin" })
      .then((res) => (isCacheable(res) ? cache.put(OFFLINE_URL, res) : undefined))
      .catch(() => undefined);
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jamais d'interception des appels réseau externes (Supabase, etc.)
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (isRscRequest(request, url)) return;

  // Statiques : cache-first
  if (isCacheableStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (isCacheable(res)) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations : network-first, repli cache, puis page hors-ligne
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) =>
              c.put(request, copy).then(() => ensureOfflineFallback(c)),
            );
          }
          return res;
        })
        .catch(() =>
          caches
            .match(request, { ignoreSearch: true })
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then(
              (res) =>
                res ||
                new Response("", { status: 504, statusText: "Hors connexion" }),
            ),
        ),
    );
  }
});

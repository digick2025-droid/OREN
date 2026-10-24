/*
 * Service worker OREN — hors-ligne « consultation + brouillons ».
 * - Statiques (_next/static, icônes) : cache-first.
 * - Navigations : network-first, repli sur la page en cache puis sur OFFLINE_URL.
 *   Sur un réseau qui traîne, la page en cache est servie au bout de
 *   NAVIGATION_TIMEOUT_MS : la réponse réseau, si elle arrive, met le cache à jour.
 * - Préchargement (message « warm ») : une fois connecté, l'app demande les
 *   écrans essentiels et leurs scripts, pour qu'ils s'ouvrent hors ligne sans
 *   avoir été visités.
 * - Supabase / API : jamais mis en cache (données authentifiées, temps réel).
 *
 * Deux règles non négociables, chacune a déjà cassé le mode hors-ligne :
 *  1. On ne met JAMAIS en cache une réponse redirigée. Sans session, le
 *     middleware renvoie /connexion : on stockait la page de connexion sous la
 *     clé /accueil, et tout le hors-ligne affichait le formulaire de login.
 *  2. On précharge un par un, jamais avec addAll : addAll est atomique, une
 *     seule URL en échec vidait tout le préchargement — en silence.
 */
/* À incrémenter à chaque changement du manifest ou des icônes : ils sont
 * servis cache-first, l'ancienne version resterait sinon sur les appareils. */
const CACHE = "oren-v4";
/* Au-delà, la page en cache (si elle existe) est servie sans attendre le réseau. */
const NAVIGATION_TIMEOUT_MS = 4000;
/* Une page préchargée depuis moins longtemps n'est pas retéléchargée : le
 * forfait data de l'utilisateur n'a pas à payer chaque ouverture de l'app. */
const WARM_MAX_AGE_MS = 12 * 60 * 60 * 1000;
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
  // Police des devis/factures : le PDF garde la police de l'app hors-ligne.
  "/fonts/inter-latin.woff2",
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

/* ------------------------------------------------------------------
 * Préchargement des écrans essentiels
 * ------------------------------------------------------------------ */

/* Scripts, styles et polices référencés par une page : sans eux, la page en
 * cache s'afficherait hors ligne mais resterait inerte (aucun bouton ne
 * répond tant que React n'a pas hydraté). On prend les balises <script src>
 * comme les chemins `static/chunks/…` cités dans la charge RSC intégrée. */
function staticAssetsOf(html) {
  const found = new Set();
  const re = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'\\\s<>]+?\.(?:js|css|woff2?)/g;
  let m;
  while ((m = re.exec(html))) {
    found.add(m[0].startsWith("/_next/") ? m[0] : `/_next/${m[0]}`);
  }
  return [...found];
}

function isFresh(response) {
  const date = Date.parse(response.headers.get("date") || "");
  return Number.isFinite(date) && Date.now() - date < WARM_MAX_AGE_MS;
}

async function warmPage(cache, url) {
  const cached = await cache.match(url, { ignoreVary: true });
  if (cached && isFresh(cached)) return;
  const res = await fetch(url, { credentials: "same-origin" });
  // Redirigée = plus de session (ou page refusée à ce rôle) : rien à garder.
  if (!isCacheable(res)) return;
  if (!(res.headers.get("content-type") || "").includes("text/html")) return;
  const html = await res.clone().text();
  await cache.put(url, res);
  await cacheAssets(cache, staticAssetsOf(html));
}

async function cacheAssets(cache, assets) {
  await Promise.all(
    assets.map(async (asset) => {
      if (await cache.match(asset, { ignoreSearch: true })) return;
      const r = await fetch(asset).catch(() => undefined);
      if (!isCacheable(r)) return;
      // Les polices ne sont citées que dans les feuilles de style.
      if (asset.endsWith(".css")) {
        const css = await r.clone().text();
        await cache.put(asset, r);
        await cacheAssets(cache, staticAssetsOf(css).filter((a) => !a.endsWith(".css")));
        return;
      }
      await cache.put(asset, r);
    }),
  );
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "warm" || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter(
    (u) => typeof u === "string" && u.startsWith("/") && !u.startsWith("//"),
  );
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Une page après l'autre : sur un réseau 3G, neuf requêtes en parallèle
      // ralentiraient l'écran que l'utilisateur est en train d'ouvrir.
      for (const url of urls) {
        await warmPage(cache, url).catch(() => undefined);
      }
      await ensureOfflineFallback(cache);
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

  // Statiques : cache-first. Leur nom porte déjà un hash de contenu : on
  // ignore les paramètres (`?dpl=` de la protection de version Vercel), que le
  // préchargement ne voit pas dans le HTML.
  if (isCacheableStatic(url)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(
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
    event.respondWith(navigate(event, request));
  }
});

/* La page exacte d'abord : `/nouveau?type=facture` ne doit pas ouvrir le
 * formulaire de devis mis en cache sous `/nouveau?type=devis`. Le repli sans
 * paramètres ne sert qu'aux URL jamais vues (`/documents/abc?created=1`). */
function cachedPage(request) {
  return caches
    .match(request, { ignoreVary: true })
    .then((exact) => exact || caches.match(request, { ignoreSearch: true, ignoreVary: true }));
}

function navigate(event, request) {
  const network = fetch(request).then((res) => {
    if (isCacheable(res)) {
      const copy = res.clone();
      const saving = caches
        .open(CACHE)
        .then((c) => c.put(request, copy).then(() => ensureOfflineFallback(c)));
      // Réponse arrivée après le repli sur le cache : l'événement est déjà
      // clos et `waitUntil` lève — l'écriture se fait alors sans lui.
      try {
        event.waitUntil(saving);
      } catch {
        // pas de prolongation possible, sans gravité
      }
    }
    return res;
  });

  const offline = () =>
    cachedPage(request)
      .then((cached) => cached || caches.match(OFFLINE_URL))
      .then(
        (res) =>
          res || new Response("", { status: 504, statusText: "Hors connexion" }),
      );

  // Réseau lent (3G saturée, Wi-Fi sans internet) : la page en cache plutôt
  // qu'un écran blanc, mais seulement si on en a une — sinon on attend le
  // réseau jusqu'au bout, la page de repli n'apprendrait rien à l'utilisateur.
  const slow = new Promise((resolve) => {
    setTimeout(() => {
      cachedPage(request).then((cached) => cached && resolve(cached));
    }, NAVIGATION_TIMEOUT_MS);
  });

  return Promise.race([network.catch(offline), slow]);
}

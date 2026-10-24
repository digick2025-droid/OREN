import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Routes accessibles sans session */
const PUBLIC_PATHS = [
  "/",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/mot-de-passe",
  "/auth",
  "/express",
  "/offres",
  "/design-system",
  "/paiement/retour",
  "/api/payments",
  // Callbacks des passerelles de paiement. Une passerelle n'a pas de session :
  // sans cette entrée, le middleware la redirige vers /connexion et la
  // notification n'atteint jamais le handler — un paiement encaissé qui ne
  // serait jamais confirmé. L'authenticité est vérifiée par signature HMAC
  // dans la route elle-même, jamais par la session.
  "/api/webhooks",
  // Tâches planifiées Vercel. Le déclencheur n'a pas de session : sans cette
  // entrée, le cron des relances serait redirigé vers /connexion et ne
  // s'exécuterait jamais — en silence, comme un webhook perdu. La route se
  // protège elle-même par CRON_SECRET.
  "/api/cron",
  "/manifest.webmanifest",
  // Le service worker et sa page de repli. Sans session, le middleware
  // redirigeait /sw.js vers /connexion : le navigateur recevait du text/html
  // et refusait d'enregistrer le worker (« unsupported MIME type ») — donc
  // aucun mode hors-ligne pour un visiteur dont le cookie a expiré.
  "/sw.js",
  "/hors-ligne.html",
  "/robots.txt",
  "/sitemap.xml",
];

/** Exportée pour être éprouvée : une route publique oubliée est invisible. */
export function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
}

/**
 * Posé à la première session valide vue sur l'appareil, gardé un an : il
 * survit à la déconnexion et à l'expiration de la session, contrairement aux
 * cookies Supabase. Il ne prouve rien (aucune donnée, aucun droit) : il dit
 * seulement « ce visiteur a déjà un compte, inutile de lui vendre l'app ».
 */
export const ACCOUNT_COOKIE = "oren_compte";
const ACCOUNT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Un détenteur de compte qui arrive sur « / » de l'extérieur (adresse tapée,
 * favori, lien partagé) va droit à l'app — et donc à /connexion s'il n'a plus
 * de session. Un clic sur un lien interne vers « / » montre toujours la
 * vitrine : sinon le lien retour de /connexion bouclerait sur lui-même.
 */
export function shouldSkipLanding(request: NextRequest): boolean {
  if (request.nextUrl.pathname !== "/") return false;
  if (!request.cookies.has(ACCOUNT_COOKIE)) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin";
  // Navigateurs sans Sec-Fetch-Site : un référent interne vaut clic interne.
  const referer = request.headers.get("referer");
  return !referer || new URL(referer).origin !== request.nextUrl.origin;
}

export async function updateSession(request: NextRequest) {
  if (shouldSkipLanding(request)) {
    // /accueil plutôt que /connexion : avec une session encore valide, on
    // entre directement ; sans, la garde ci-dessous renvoie vers /connexion.
    const url = request.nextUrl.clone();
    url.pathname = "/accueil";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Routes publiques : aucun appel réseau vers Supabase — réponse immédiate.
  // La session est rafraîchie sur les routes protégées uniquement.
  if (isPublic(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // La page demandée est conservée dans `next` : après connexion,
    // l'utilisateur revient là où il allait au lieu de repartir de l'accueil.
    const url = request.nextUrl.clone();
    const requested = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = "/connexion";
    url.search = "";
    if (requested !== "/accueil") url.searchParams.set("next", requested);
    return NextResponse.redirect(url);
  }

  if (!request.cookies.has(ACCOUNT_COOKIE)) {
    supabaseResponse.cookies.set(ACCOUNT_COOKIE, "1", {
      maxAge: ACCOUNT_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return supabaseResponse;
}

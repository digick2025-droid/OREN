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
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
}

export async function updateSession(request: NextRequest) {
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
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

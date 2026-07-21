import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback Supabase Auth — échange le code PKCE contre une session.
 * Utilisé pour la confirmation d'email et la réinitialisation de mot de passe.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/accueil";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const safeNext = next.startsWith("/") ? next : "/accueil";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/connexion?error=auth`);
}

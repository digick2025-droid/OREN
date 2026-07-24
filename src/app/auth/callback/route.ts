import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && OTP_TYPES.includes(value as EmailOtpType);
}

/**
 * Callback Supabase Auth — confirmation d'email et réinitialisation de mot de passe.
 *
 * Deux formats de lien sont acceptés :
 *  - `?token_hash=…&type=…` : vérification par OTP. À privilégier pour les liens
 *    reçus par email — le lien fonctionne dans n'importe quel navigateur.
 *  - `?code=…` : échange PKCE. Ne fonctionne QUE dans le navigateur qui a
 *    initié la demande (le `code_verifier` vit dans un cookie local). Un lien
 *    ouvert depuis l'app Gmail échoue donc systématiquement — d'où le repli
 *    explicite ci-dessous plutôt qu'une erreur générique.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/accueil";
  const safeNext = next.startsWith("/") ? next : "/accueil";

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    return NextResponse.redirect(
      `${origin}/connexion?error=${error.code === "otp_expired" ? "expired" : "auth"}`,
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    // Le code est valide mais le `code_verifier` manque : lien ouvert dans un
    // autre navigateur que celui de la demande.
    return NextResponse.redirect(`${origin}/connexion?error=other_browser`);
  }

  // Ni code ni token : GoTrue a renvoyé son erreur dans le fragment (#error=…),
  // invisible côté serveur. La page /connexion le lit côté client.
  return NextResponse.redirect(`${origin}/connexion?error=auth`);
}

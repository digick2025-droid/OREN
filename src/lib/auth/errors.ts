import type { AuthError } from "@supabase/supabase-js";
import type { Dict } from "@/lib/i18n/dictionaries";

/** Clés de Dict dont la valeur est un simple message (pas une liste). */
type MessageKey = { [K in keyof Dict]: Dict[K] extends string ? K : never }[keyof Dict];

/**
 * Traduit les erreurs Supabase Auth en messages utilisateur clairs.
 * On matche d'abord sur `error.code`, stable et documenté par Supabase ;
 * le texte de `message` sert de repli pour les cas non couverts (ou les
 * erreurs réseau qui n'ont pas de code).
 */
const CODE_MESSAGES: Record<string, MessageKey> = {
  invalid_credentials: "auth_error_credentials",
  user_already_exists: "auth_error_email_taken",
  email_exists: "auth_error_email_taken",
  weak_password: "auth_error_weak_password",
  user_not_found: "auth_error_not_found",
  email_not_confirmed: "auth_error_email_unconfirmed",
  email_address_invalid: "auth_error_invalid_email",
  email_address_not_authorized: "auth_error_invalid_email",
  over_request_rate_limit: "auth_error_rate_limit",
  over_email_send_rate_limit: "auth_error_rate_limit",
  over_sms_send_rate_limit: "auth_error_rate_limit",
};

export function mapAuthError(
  error: Pick<AuthError, "message" | "code">,
  t: Dict,
): string {
  const key = error.code ? CODE_MESSAGES[error.code] : undefined;
  if (key) {
    return t[key];
  }

  const lower = error.message.toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid email or password")
  ) {
    return t.auth_error_credentials;
  }
  if (
    lower.includes("user already registered") ||
    lower.includes("already been registered") ||
    lower.includes("email address is already registered")
  ) {
    return t.auth_error_email_taken;
  }
  if (
    lower.includes("password should be at least") ||
    lower.includes("password is too weak") ||
    lower.includes("weak password")
  ) {
    return t.auth_error_weak_password;
  }
  if (lower.includes("user not found") || lower.includes("no user found")) {
    return t.auth_error_not_found;
  }
  if (lower.includes("email not confirmed")) {
    return t.auth_error_email_unconfirmed;
  }
  if (
    lower.includes("invalid email") ||
    lower.includes("unable to validate email") ||
    (lower.includes("email") && lower.includes("is invalid"))
  ) {
    return t.auth_error_invalid_email;
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return t.auth_error_rate_limit;
  }

  return t.auth_error_generic;
}

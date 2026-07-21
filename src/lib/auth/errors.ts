import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * Traduit les erreurs Supabase Auth en messages utilisateur clairs.
 * Les messages Supabase varient selon la version — on matche par sous-chaîne.
 */
export function mapAuthError(message: string, t: Dict): string {
  const lower = message.toLowerCase();

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

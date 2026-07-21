/** Validation email / mot de passe pour l'authentification B2B. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Minimum 8 caractères, au moins une lettre et un chiffre. */
export function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  return /[a-zA-Z]/.test(password) && /\d/.test(password);
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password === confirm;
}

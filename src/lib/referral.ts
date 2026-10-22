/**
 * Parrainage — côté navigateur.
 *
 * Le code arrive par un lien (`/inscription?ref=OREN3FA9C2`) et doit survivre
 * jusqu'à ce que l'entreprise du filleul existe (inscription, éventuelle
 * confirmation d'email, premier chargement de l'app). On le garde donc dans
 * `localStorage`, puis `ReferralApply` le soumet une fois l'entreprise créée.
 */

export const REFERRAL_STORAGE_KEY = "oren_pending_referral";

const CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

/** Normalise un code saisi ou lu dans une URL ; null si le format est invalide. */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function buildReferralLink(origin: string, code: string): string {
  return `${origin}/inscription?ref=${encodeURIComponent(code)}`;
}

export function referralShareText(link: string, shareText: string): string {
  return `${shareText} ${link}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function savePendingReferral(code: string): void {
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    // stockage indisponible (navigation privée) : le parrainage est perdu, sans gravité
  }
}

export function readPendingReferral(): string | null {
  try {
    return normalizeReferralCode(localStorage.getItem(REFERRAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearPendingReferral(): void {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

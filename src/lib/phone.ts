/** Normalisation des numéros de téléphone (E.164, défaut Cameroun +237). */

const DEFAULT_COUNTRY_CODE = "237";

export function normalizePhoneE164(input: string): string {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length === 0) return "";
  if (hasPlus) return `+${digits}`;
  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length > 9) {
    return `+${digits}`;
  }
  return `+${DEFAULT_COUNTRY_CODE}${digits}`;
}

export function isValidPhone(input: string): boolean {
  const digits = input.replace(/[^\d]/g, "");
  return digits.length >= 8;
}

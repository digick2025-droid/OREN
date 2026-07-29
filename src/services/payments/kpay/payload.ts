import type { PaymentMethod, PaymentStatus } from "../types";

/**
 * Lecture des charges utiles K-PAY (réponses d'API et corps de webhook).
 *
 * Contrairement à CamerPay, le contrat est stable et documenté : on parse
 * donc strictement, sans tolérance sur les noms de champs.
 */

/**
 * Statuts K-PAY → notre statut normalisé.
 *
 * Prudence volontaire, comme partout ailleurs : tout ce qui n'est pas un
 * succès ou un échec explicite reste `pending`. Un statut inconnu ne doit
 * jamais faire basculer une intention — mieux vaut un paiement en attente
 * qu'une offre accordée à tort.
 */
export function normalizeStatus(raw: string | undefined): PaymentStatus {
  switch (raw?.toUpperCase().trim()) {
    case "COMPLETED":
      return "succeeded";
    case "FAILED":
    case "CANCELLED":
      return "failed";
    default:
      // PENDING, PROCESSING, ou inconnu.
      return "pending";
  }
}

/**
 * Nos moyens de paiement → codes provider K-PAY (Cameroun).
 *
 * `null` = pas de Mobile Money : la carte passerait par le mode GATEWAY
 * (page hébergée), que cette intégration n'utilise pas — tout l'intérêt de
 * K-PAY ici est justement de rester dans l'application.
 */
export function toKPayProvider(method: PaymentMethod): string | null {
  switch (method) {
    case "orange_money":
      return "ORANGE_CMR";
    case "mtn_momo":
      return "MTN_MOMO_CMR";
    default:
      return null;
  }
}

/**
 * Format accepté par K-PAY : 9 chiffres (6XXXXXXXX) ou 12 avec indicatif
 * (237XXXXXXXXX), **sans** le `+`. On normalise vers la forme internationale,
 * la moins ambiguë.
 */
export function toKPayPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("237")) return digits;
  // Saisie locale avec le 0 initial (06XXXXXXXX) : le 0 n'existe pas en
  // numérotation internationale camerounaise.
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  return `237${local}`;
}

/** Message d'erreur exploitable renvoyé par l'API, quel que soit le format. */
export function errorMessage(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const message = (data as Record<string, unknown>).message;
  if (typeof message === "string" && message.length > 0) return message;
  // NestJS renvoie parfois un tableau de messages de validation.
  if (Array.isArray(message)) {
    const first = message.find((m) => typeof m === "string" && m.length > 0);
    if (typeof first === "string") return first;
  }
  return undefined;
}

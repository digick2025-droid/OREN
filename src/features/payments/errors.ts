import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * Traduit le code d'échec renvoyé par `/api/payments` en phrase utile au payeur.
 *
 * Un « le paiement a échoué, réessayez » générique fait recommencer dix fois la
 * même tentative vouée à échouer : un numéro mal saisi, un moyen indisponible
 * et une passerelle en panne n'appellent pas du tout la même réaction.
 *
 * Les codes inconnus qui ressemblent à un code machine (SCREAMING_SNAKE) sont
 * masqués ; un message rédigé par la passerelle (« Solde insuffisant ») est en
 * revanche affiché tel quel : c'est l'opérateur qui sait pourquoi il a refusé.
 */
export function paymentErrorMessage(
  code: string | undefined,
  t: Dict,
): string {
  if (!code) return t.pay_failed;

  switch (code) {
    case "INVALID_PHONE":
      return t.pay_error_phone;
    case "METHOD_NOT_SUPPORTED":
      return t.pay_error_method;
    case "PROVIDER_NOT_CONFIGURED":
    case "PAYMENTS_NOT_CONFIGURED":
      return t.pay_error_config;
    case "DUPLICATE_REFERENCE":
      return t.pay_error_duplicate;
    case "RATE_LIMITED":
      return t.pay_error_rate_limited;
    case "PROVIDER_UNREACHABLE":
    case "PROVIDER_BAD_RESPONSE":
      return t.pay_error_unavailable;
    default:
      break;
  }

  // PROVIDER_HTTP_401, PROVIDER_HTTP_500… : la passerelle nous a répondu de
  // travers. Côté payeur c'est une indisponibilité ; le code exact, lui, est
  // enregistré sur l'intention pour que nous, on sache quoi corriger.
  if (code.startsWith("PROVIDER_HTTP_")) return t.pay_error_unavailable;

  if (isMachineCode(code)) return t.pay_failed;
  return code;
}

/** `INVALID_PHONE` oui, `Solde insuffisant` non. */
function isMachineCode(value: string): boolean {
  return /^[A-Z0-9_]+$/.test(value);
}

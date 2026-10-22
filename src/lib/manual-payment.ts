/**
 * Paiement manuel Mobile Money — numéros marchands et validation de la
 * référence de transaction (voir MANUAL_PAYMENT dans billing.ts).
 */

export type ManualOperator = "orange_money" | "mtn_momo";

export interface ManualAccount {
  operator: ManualOperator;
  label: string;
  /** Numéro tel que composé, sans espace. */
  number: string;
  /** Numéro lisible, groupé comme on le dicte au Cameroun. */
  display: string;
  /** Menu USSD de l'opérateur pour envoyer de l'argent. */
  ussd: string;
}

export const MANUAL_ACCOUNTS: Record<ManualOperator, ManualAccount> = {
  orange_money: {
    operator: "orange_money",
    label: "Orange Money",
    number: "655523960",
    display: "655 52 39 60",
    ussd: "#150#",
  },
  mtn_momo: {
    operator: "mtn_momo",
    label: "MTN MoMo",
    number: "677149683",
    display: "677 14 96 83",
    ussd: "*126#",
  },
};

/**
 * Normalise la référence recopiée depuis le SMS de confirmation ; null si
 * elle n'a pas la forme d'une référence d'opérateur.
 *
 * Orange envoie des références du type « MP231022.1530.A12345 », MTN un
 * identifiant numérique long : on accepte lettres, chiffres, points et
 * tirets, 6 à 40 caractères, espaces retirés et en majuscules — deux
 * saisies de la même référence donnent la même valeur (unicité en base).
 */
export function normalizeTransactionRef(
  raw: string | null | undefined,
): string | null {
  const ref = (raw ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9.-]{6,40}$/.test(ref)) return null;
  // Au moins 4 chiffres : écarte « AAAAAA » et les mots saisis par erreur.
  if ((ref.match(/\d/g) ?? []).length < 4) return null;
  return ref;
}

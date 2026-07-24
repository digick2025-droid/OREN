import crypto from "node:crypto";

/**
 * Vérification de la signature d'un callback CamerPay.
 *
 * Contrat réel (confirmé le 24/07/2026 via le « Webhook tester » du tableau
 * de bord CamerPay — la doc initiale annonçait du JSON, ce n'est pas ce que
 * CamerPay envoie réellement) :
 *   - Corps en **`application/x-www-form-urlencoded`**, pas en JSON.
 *   - Champs `uuid`, `invoice_id`, `status`, `amount`, `signature`.
 *   - `signature` est aussi dupliquée dans l'en-tête `X-CamerPay-Signature`
 *     (même valeur) ; on lit le champ du corps, qui fait foi dans l'exemple
 *     officiel (`$_POST['signature']`).
 *   - Calcul : quatre champs concaténés par des barres verticales :
 *
 *     hmac_sha256("uuid|invoice_id|status|amount", secret)
 *
 * Conséquences à garder en tête :
 *   - Les autres champs du callback (`test`, en-têtes `X-CamerPay-Event*`,
 *     `Idempotency-Key`) ne sont PAS signés : ils sont informatifs et ne
 *     doivent jamais décider de quoi que ce soit.
 *   - `amount` étant signé, on peut le comparer au montant attendu de
 *     l'intention — c'est ce qui empêche qu'un paiement de 100 FCFA valide
 *     un abonnement à 3000. CamerPay l'envoie avec 2 décimales ("5000.00") ;
 *     `Number()` le compare correctement à un montant entier stocké.
 */

/** Champs signés d'un callback CamerPay, une fois validés. */
export interface CamerPayCallback {
  transactionUuid: string;
  invoiceId: string;
  status: string;
  /** Montant tel que reçu, en chaîne : c'est cette forme exacte qui est signée. */
  amount: string;
}

/** Extrait les champs signés d'une charge utile brute, ou null si incomplète. */
export function parseCallback(payload: unknown): CamerPayCallback | null {
  if (typeof payload !== "object" || payload === null) return null;
  const body = payload as Record<string, unknown>;

  const transactionUuid = asString(body.uuid);
  const invoiceId = asString(body.invoice_id);
  const status = asString(body.status);
  const amount = asString(body.amount);

  if (!transactionUuid || !invoiceId || !status || amount === undefined) {
    return null;
  }
  return { transactionUuid, invoiceId, status, amount };
}

/**
 * Vérifie la signature d'un callback CamerPay.
 *
 * @param callback Champs signés, issus de `parseCallback`.
 * @param signature Valeur du champ `signature` du corps JSON (hex).
 * @param secret    Secret callback du tableau de bord CamerPay.
 */
export function verifyCallbackSignature(
  callback: CamerPayCallback,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const data = [
    callback.transactionUuid,
    callback.invoiceId,
    callback.status,
    callback.amount,
  ].join("|");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(data, "utf8")
    .digest("hex");

  return timingSafeEqualHex(expected, signature.trim());
}

/** Comparaison à temps constant de deux empreintes hex (anti timing-attack). */
function timingSafeEqualHex(expected: string, provided: string): boolean {
  // `Buffer.from(x, "hex")` ignore silencieusement les caractères invalides :
  // une chaîne non hexadécimale donnerait un buffer plus court qu'attendu.
  // On valide donc la forme AVANT de comparer.
  if (!/^[0-9a-f]+$/i.test(provided)) return false;
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Normalise une valeur en chaîne pour la signature.
 *
 * CamerPay signe la concaténation de valeurs telles qu'elles apparaissent
 * dans le JSON : un `amount` numérique (5000) doit redonner "5000".
 */
function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

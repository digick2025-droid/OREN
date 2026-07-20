import crypto from "node:crypto";

/**
 * Vérification de la signature d'un callback CamerPay.
 *
 * Contrat réel (doc « API REST » → onglet Webhooks du tableau de bord) :
 * la signature n'est PAS un en-tête HTTP couvrant le corps brut, mais un
 * champ `signature` **dans le corps JSON**, calculé sur quatre champs
 * concaténés par des barres verticales :
 *
 *     hmac_sha256("transaction_uuid|invoice_id|status|amount", secret)
 *
 * Conséquences à garder en tête :
 *   - Les autres champs du callback (`payment_method`, `paid_at`,
 *     `provider_tx_id`, `currency`) ne sont PAS signés : ils sont
 *     informatifs et ne doivent jamais décider de quoi que ce soit.
 *   - `amount` étant signé, on peut le comparer au montant attendu de
 *     l'intention — c'est ce qui empêche qu'un paiement de 100 FCFA valide
 *     un abonnement à 3000.
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

  const transactionUuid = asString(body.transaction_uuid);
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

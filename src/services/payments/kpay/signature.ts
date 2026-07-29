import crypto from "node:crypto";

/**
 * Vérification de la signature d'un webhook K-PAY.
 *
 * Contrat (doc « Webhooks » du tableau de bord K-PAY) :
 *   - POST `application/json`.
 *   - En-tête `X-KPAY-Signature` : HMAC-SHA256 hexadécimal calculé sur le
 *     **corps brut reçu**, pas sur un JSON re-sérialisé.
 *   - En-tête `X-KPAY-Event` : `payment.completed`, `payment.failed`,
 *     `payment.cancelled`.
 *
 * ⚠️ C'est l'inverse de CamerPay, qui signe la concaténation de 4 champs.
 * Ici, re-sérialiser le JSON avant de calculer l'empreinte suffit à faire
 * échouer la vérification (ordre des clés, espaces, échappements) : le corps
 * doit être lu en texte et transmis tel quel.
 */

/** Champs exploités d'un événement K-PAY, une fois la signature validée. */
export interface KPayEvent {
  /** Notre référence interne, passée en `externalId` à l'initiation. */
  externalId: string;
  /** Référence K-PAY de la transaction. */
  reference: string;
  status: string;
  amount?: number;
  failureReason?: string;
}

/** Extrait les champs utiles d'un corps déjà parsé, ou null si inexploitable. */
export function parseEvent(payload: unknown): KPayEvent | null {
  if (typeof payload !== "object" || payload === null) return null;
  const body = payload as Record<string, unknown>;

  const externalId = asString(body.externalId);
  const status = asString(body.status);
  // Sans `externalId`, l'événement ne se rattache à aucune de nos intentions :
  // inexploitable, même signé.
  if (!externalId || !status) return null;

  const amount = Number(body.amount);
  return {
    externalId,
    reference: asString(body.reference) ?? "",
    status,
    amount: Number.isFinite(amount) ? amount : undefined,
    failureReason: asString(body.failureReason),
  };
}

/**
 * Vérifie la signature d'un webhook K-PAY.
 *
 * @param rawBody   Corps de la requête, exactement tel que reçu.
 * @param signature Valeur de l'en-tête `X-KPAY-Signature` (hex).
 * @param secret    Secret webhook défini dans le tableau de bord K-PAY.
 */
export function verifyEventSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  return timingSafeEqualHex(expected, signature.trim());
}

/** Comparaison à temps constant de deux empreintes hex (anti timing-attack). */
function timingSafeEqualHex(expected: string, provided: string): boolean {
  // `Buffer.from(x, "hex")` ignore silencieusement les caractères invalides :
  // une chaîne non hexadécimale donnerait un buffer plus court qu'attendu.
  if (!/^[0-9a-f]+$/i.test(provided)) return false;
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

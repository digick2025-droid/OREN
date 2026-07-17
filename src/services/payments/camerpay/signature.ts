import crypto from "node:crypto";

/**
 * Vérifie la signature HMAC-SHA256 d'un webhook CamerPay.
 * Le secret HMAC est celui déclaré dans le tableau de bord CamerPay
 * (écran « Clés API & Webhooks »).
 *
 * @param rawBody  Corps HTTP brut (non re-sérialisé), tel que reçu.
 * @param signature Valeur du header de signature (hex).
 * @param secret   Secret HMAC partagé.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Certaines passerelles préfixent la signature (ex. "sha256=") : on tolère.
  const provided = signature.includes("=")
    ? signature.split("=").pop() ?? signature
    : signature;

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");

  // Comparaison à temps constant (anti timing-attack), longueurs égales requises.
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

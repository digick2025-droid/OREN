import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseCallback, verifyCallbackSignature } from "./signature";

const SECRET = "secret_de_test_camerpay";

/**
 * Reproduit littéralement la formule de la doc CamerPay :
 *   hash_hmac('sha256', "uuid|invoice|status|amount", $secret)
 * Volontairement écrit à part, sans réutiliser le code testé.
 */
function sign(
  parts: [string, string, string, string | number],
  secret = SECRET,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(parts.join("|"), "utf8")
    .digest("hex");
}

/** Callback conforme à l'exemple de la doc. */
function callbackBody(overrides: Record<string, unknown> = {}) {
  return {
    transaction_uuid: "uuid-de-la-transaction",
    invoice_id: "OREN-SUB-001",
    status: "completed",
    amount: 5000,
    currency: "XAF",
    payment_method: "mtn_momo",
    provider_tx_id: "tx-id-provider",
    paid_at: "2026-04-04T12:00:00Z",
    ...overrides,
  };
}

describe("parseCallback", () => {
  it("extrait les quatre champs signés", () => {
    expect(parseCallback(callbackBody())).toEqual({
      transactionUuid: "uuid-de-la-transaction",
      invoiceId: "OREN-SUB-001",
      status: "completed",
      amount: "5000",
    });
  });

  it("accepte un montant déjà transmis en chaîne", () => {
    expect(parseCallback(callbackBody({ amount: "5000" }))?.amount).toBe("5000");
  });

  it.each(["transaction_uuid", "invoice_id", "status", "amount"])(
    "refuse une charge sans %s",
    (field) => {
      const body = callbackBody();
      delete (body as Record<string, unknown>)[field];
      expect(parseCallback(body)).toBeNull();
    },
  );

  it("refuse une charge qui n'est pas un objet", () => {
    expect(parseCallback(null)).toBeNull();
    expect(parseCallback("texte")).toBeNull();
  });
});

describe("verifyCallbackSignature", () => {
  const parts: [string, string, string, number] = [
    "uuid-de-la-transaction",
    "OREN-SUB-001",
    "completed",
    5000,
  ];

  it("accepte la signature calculée selon la doc CamerPay", () => {
    const callback = parseCallback(callbackBody())!;
    expect(verifyCallbackSignature(callback, sign(parts), SECRET)).toBe(true);
  });

  it("donne le même résultat que le montant vienne en nombre ou en chaîne", () => {
    const callback = parseCallback(callbackBody({ amount: "5000" }))!;
    expect(verifyCallbackSignature(callback, sign(parts), SECRET)).toBe(true);
  });

  it("rejette une signature calculée avec un autre secret", () => {
    const callback = parseCallback(callbackBody())!;
    expect(
      verifyCallbackSignature(callback, sign(parts, "mauvais_secret"), SECRET),
    ).toBe(false);
  });

  // Le scénario d'attaque qui compte : rejouer un vrai callback en changeant
  // le statut ou le montant. Les deux sont signés, donc les deux doivent sauter.
  it("rejette un statut altéré", () => {
    const callback = parseCallback(callbackBody({ status: "failed" }))!;
    expect(verifyCallbackSignature(callback, sign(parts), SECRET)).toBe(false);
  });

  it("rejette un montant altéré", () => {
    const callback = parseCallback(callbackBody({ amount: 100 }))!;
    expect(verifyCallbackSignature(callback, sign(parts), SECRET)).toBe(false);
  });

  it("rejette une référence de facture altérée", () => {
    const callback = parseCallback(callbackBody({ invoice_id: "OREN-SUB-999" }))!;
    expect(verifyCallbackSignature(callback, sign(parts), SECRET)).toBe(false);
  });

  it("rejette une signature absente", () => {
    const callback = parseCallback(callbackBody())!;
    expect(verifyCallbackSignature(callback, null, SECRET)).toBe(false);
    expect(verifyCallbackSignature(callback, "", SECRET)).toBe(false);
  });

  it("rejette un secret absent", () => {
    const callback = parseCallback(callbackBody())!;
    expect(verifyCallbackSignature(callback, sign(parts), "")).toBe(false);
  });

  // Buffer.from(x, "hex") ignore les caractères invalides : sans validation
  // de forme, une signature bidon pourrait produire un buffer de la bonne
  // longueur et passer la comparaison.
  it("rejette une signature non hexadécimale", () => {
    const callback = parseCallback(callbackBody())!;
    expect(verifyCallbackSignature(callback, "pas-de-l-hexa!!", SECRET)).toBe(
      false,
    );
    expect(verifyCallbackSignature(callback, "zz".repeat(32), SECRET)).toBe(
      false,
    );
  });

  it("rejette une signature de longueur invalide", () => {
    const callback = parseCallback(callbackBody())!;
    expect(verifyCallbackSignature(callback, "abcd", SECRET)).toBe(false);
  });

  it("tolère des espaces autour de la signature", () => {
    const callback = parseCallback(callbackBody())!;
    expect(verifyCallbackSignature(callback, ` ${sign(parts)} `, SECRET)).toBe(
      true,
    );
  });
});

import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./signature";

const SECRET = "test_hmac_secret";

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyWebhookSignature — webhook CamerPay", () => {
  const body = JSON.stringify({ reference: "CP-123", status: "success" });

  it("accepte une signature valide", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("tolère un préfixe sha256=", () => {
    expect(
      verifyWebhookSignature(body, `sha256=${sign(body)}`, SECRET),
    ).toBe(true);
  });

  it("rejette une signature calculée avec un autre secret", () => {
    expect(
      verifyWebhookSignature(body, sign(body, "mauvais_secret"), SECRET),
    ).toBe(false);
  });

  it("rejette un corps altéré", () => {
    const tampered = JSON.stringify({ reference: "CP-123", status: "failed" });
    expect(verifyWebhookSignature(tampered, sign(body), SECRET)).toBe(false);
  });

  it("rejette une signature absente", () => {
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
  });

  it("rejette un secret absent", () => {
    expect(verifyWebhookSignature(body, sign(body), "")).toBe(false);
  });

  it("rejette une signature de longueur invalide", () => {
    expect(verifyWebhookSignature(body, "abcd", SECRET)).toBe(false);
  });
});

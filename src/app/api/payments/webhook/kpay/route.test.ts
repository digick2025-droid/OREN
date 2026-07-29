import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Webhook K-PAY. La signature porte sur le CORPS BRUT : ces tests postent donc
 * des chaînes exactes, jamais un objet re-sérialisé — c'est précisément le
 * piège que la vérification doit attraper.
 */

const settlePaymentIntent = vi.fn();
let storedIntent: { amount: number | string; status: string } | null = null;

vi.mock("@/services/payments", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: storedIntent }) }),
      }),
    }),
  }),
  settlePaymentIntent: (...args: unknown[]) => settlePaymentIntent(...args),
}));

const { POST } = await import("./route");

const SECRET = "secret_de_test_kpay";

function sign(rawBody: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

function post(rawBody: string, signature?: string | null): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const value = signature === undefined ? sign(rawBody) : signature;
  if (value !== null) headers["X-KPAY-Signature"] = value;
  return new NextRequest("http://localhost/api/payments/webhook/kpay", {
    method: "POST",
    body: rawBody,
    headers,
  });
}

function event(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    event: "payment.completed",
    paymentId: "pay_abc123",
    reference: "KPAY-20260729-ABC123",
    status: "COMPLETED",
    amount: 3000,
    externalId: "OREN-SUB-001",
    failureReason: null,
    ...overrides,
  });
}

describe("POST /api/payments/webhook/kpay", () => {
  const originalSecret = process.env.KPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.KPAY_WEBHOOK_SECRET = SECRET;
    settlePaymentIntent.mockReset();
    settlePaymentIntent.mockResolvedValue("succeeded");
    storedIntent = { amount: 3000, status: "pending" };
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.KPAY_WEBHOOK_SECRET;
    else process.env.KPAY_WEBHOOK_SECRET = originalSecret;
  });

  it("regle l'intention sur un evenement signe", async () => {
    const response = await POST(post(event()));

    expect(response.status).toBe(200);
    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "OREN-SUB-001",
        providerReference: "KPAY-20260729-ABC123",
        status: "succeeded",
      }),
      expect.anything(),
    );
  });

  it("rejette une signature invalide sans rien regler", async () => {
    const response = await POST(post(event(), "deadbeef"));

    expect(response.status).toBe(401);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });

  it("rejette une signature absente", async () => {
    const response = await POST(post(event(), null));

    expect(response.status).toBe(401);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });

  it("rejette une signature calculee sur un corps re-serialise", async () => {
    const raw = event();
    // Meme contenu, ordre des cles different : la signature ne doit pas passer.
    const reordered = JSON.stringify({ ...JSON.parse(raw), event: "payment.completed" });
    const response = await POST(post(raw, sign(reordered + " ")));

    expect(response.status).toBe(401);
  });

  it("refuse tout sans secret configure, jamais de mode degrade", async () => {
    delete process.env.KPAY_WEBHOOK_SECRET;

    const response = await POST(post(event()));

    expect(response.status).toBe(500);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });

  it("marque l'echec et remonte le motif de l'operateur", async () => {
    const raw = event({
      event: "payment.failed",
      status: "FAILED",
      failureReason: "Solde insuffisant",
    });

    await POST(post(raw));

    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failureReason: "Solde insuffisant",
      }),
      expect.anything(),
    );
  });

  it("identifie une annulation client", async () => {
    await POST(post(event({ event: "payment.cancelled", status: "CANCELLED" })));

    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureCode: "CANCELLED" }),
      expect.anything(),
    );
  });

  it("refuse de confirmer un montant different de l'intention", async () => {
    settlePaymentIntent.mockResolvedValue("failed");

    const response = await POST(post(event({ amount: 100 })));

    expect(response.status).toBe(400);
    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureCode: "AMOUNT_MISMATCH" }),
      expect.anything(),
    );
  });

  it("accepte un montant renvoye en decimal", async () => {
    storedIntent = { amount: "3000", status: "pending" };

    const response = await POST(post(event({ amount: 3000 })));

    expect(response.status).toBe(200);
    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "succeeded" }),
      expect.anything(),
    );
  });

  it("rejette un evenement sans externalId : rattachable a rien", async () => {
    const response = await POST(post(event({ externalId: undefined })));

    expect(response.status).toBe(400);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });

  it("repond 404 sur une reference inconnue, pour ne pas faire rejouer", async () => {
    settlePaymentIntent.mockResolvedValue(null);

    const response = await POST(post(event()));

    expect(response.status).toBe(404);
  });

  it("repond 500 sur erreur base, pour que K-PAY rejoue", async () => {
    settlePaymentIntent.mockRejectedValue(new Error("db down"));

    const response = await POST(post(event()));

    expect(response.status).toBe(500);
  });

  it("rejette un corps qui n'est pas du JSON", async () => {
    const raw = "pas du json";

    const response = await POST(post(raw));

    expect(response.status).toBe(400);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });
});

import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settlePaymentIntent = vi.fn();
/** Intention retournée par la lecture de contrôle du montant. */
let storedIntent: { amount: number | string; status: string } | null = null;

// On garde la vraie vérification de signature (c'est elle qu'on éprouve) et
// on ne remplace que les accès base.
vi.mock("@/services/payments", async () => {
  const actual =
    await vi.importActual<typeof import("@/services/payments")>(
      "@/services/payments",
    );
  return {
    ...actual,
    createServiceClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: storedIntent }),
          }),
        }),
      }),
    }),
    settlePaymentIntent: (...args: unknown[]) => settlePaymentIntent(...args),
  };
});

const { POST } = await import("./route");

const SECRET = "secret_de_test_camerpay";

function sign(
  parts: [string, string, string, string | number],
  secret = SECRET,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(parts.join("|"), "utf8")
    .digest("hex");
}

/** Callback CamerPay complet et correctement signé. */
function signedBody(overrides: Record<string, unknown> = {}) {
  const body = {
    transaction_uuid: "uuid-tx",
    invoice_id: "OREN-SUB-001",
    status: "completed",
    amount: 3000,
    currency: "XAF",
    payment_method: "mtn_momo",
    ...overrides,
  };
  return {
    ...body,
    signature: sign([
      String(body.transaction_uuid),
      String(body.invoice_id),
      String(body.status),
      body.amount as number,
    ]),
  };
}

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/payments/webhook", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/payments/webhook", () => {
  beforeEach(() => {
    settlePaymentIntent.mockReset();
    settlePaymentIntent.mockResolvedValue("succeeded");
    storedIntent = { amount: 3000, status: "pending" };
    process.env.CAMERPAY_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.CAMERPAY_WEBHOOK_SECRET;
  });

  it("règle l'intention sur un callback correctement signé", async () => {
    const response = await POST(post(signedBody()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      status: "succeeded",
    });
    // `invoice_id` est notre référence ; `transaction_uuid` celle de CamerPay.
    expect(settlePaymentIntent).toHaveBeenCalledWith(
      {
        reference: "OREN-SUB-001",
        providerReference: "uuid-tx",
        status: "succeeded",
      },
      expect.anything(),
    );
  });

  it("traduit un échec CamerPay en intention échouée", async () => {
    settlePaymentIntent.mockResolvedValue("failed");
    const response = await POST(post(signedBody({ status: "failed" })));

    expect(response.status).toBe(200);
    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
      expect.anything(),
    );
  });

  // Cœur de la sécurité : la route est publique, la signature est la seule
  // barrière. Rien de non signé ne doit toucher la base.
  it("rejette une signature calculée avec un autre secret", async () => {
    const body = signedBody();
    body.signature = sign(["uuid-tx", "OREN-SUB-001", "completed", 3000], "autre");
    const response = await POST(post(body));

    expect(response.status).toBe(401);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });

  it("rejette un statut modifié après signature", async () => {
    const body = signedBody({ status: "failed" });
    // Signature valide pour "failed", mais le corps annonce "completed".
    const response = await POST(post({ ...body, status: "completed" }));

    expect(response.status).toBe(401);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });

  it("rejette un callback sans signature", async () => {
    const { signature: _omis, ...body } = signedBody();
    const response = await POST(post(body));

    expect(response.status).toBe(401);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });

  it("refuse tout si le secret n'est pas configuré", async () => {
    delete process.env.CAMERPAY_WEBHOOK_SECRET;
    const response = await POST(post(signedBody()));

    expect(response.status).toBe(500);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });

  it("répond 400 sur un corps incomplet", async () => {
    const response = await POST(post({ status: "completed" }));

    expect(response.status).toBe(400);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });

  // CamerPay ne connaît pas nos tarifs : un callback signé annonçant 100 FCFA
  // ne doit pas régler une intention à 3000.
  it("refuse et échoue l'intention si le montant payé ne correspond pas", async () => {
    const response = await POST(post(signedBody({ amount: 100 })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "AMOUNT_MISMATCH" });
    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
      expect.anything(),
    );
  });

  it("accepte un montant renvoyé en chaîne par la base", async () => {
    storedIntent = { amount: "3000", status: "pending" };
    const response = await POST(post(signedBody()));

    expect(response.status).toBe(200);
  });

  it("répond 404 sur une référence inconnue (évite 5 rejeux inutiles)", async () => {
    storedIntent = null;
    settlePaymentIntent.mockResolvedValue(null);
    const response = await POST(post(signedBody()));

    expect(response.status).toBe(404);
  });

  // 500 ⇒ CamerPay rejoue (jusqu'à 5 fois). Sans danger : le règlement est idempotent.
  it("répond 500 si le règlement échoue, pour provoquer un rejeu", async () => {
    settlePaymentIntent.mockRejectedValue(new Error("db down"));
    const response = await POST(post(signedBody()));

    expect(response.status).toBe(500);
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Réconciliation active : `/api/payments/status` ne se contente plus de lire
 * la base, il demande à la passerelle où en est réellement la transaction.
 * C'est ce qui fait aboutir un paiement quand le webhook n'arrive jamais.
 *
 * Ce qu'on éprouve ici, c'est la prudence : on ne règle que sur une réponse
 * claire de la passerelle, et un montant qui ne correspond pas ne vaut pas
 * confirmation.
 */

const settlePaymentIntent = vi.fn();
const checkStatus = vi.fn();
let storedIntent: Record<string, unknown> | null = null;

vi.mock("@/services/payments", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: storedIntent }) }),
      }),
    }),
  }),
  settlePaymentIntent: (...args: unknown[]) => settlePaymentIntent(...args),
  getPaymentProvider: () => ({
    name: "camerpay",
    initiate: vi.fn(),
    checkStatus: (...args: unknown[]) => checkStatus(...args),
  }),
}));

const { GET } = await import("./route");

function get(ref = "OREN-EXP-1"): NextRequest {
  return new NextRequest(
    `http://localhost/api/payments/status?ref=${encodeURIComponent(ref)}`,
  );
}

const pendingIntent = {
  status: "pending",
  purpose: "express_document",
  plan_key: null,
  provider: "camerpay",
  provider_reference: "CP-TX-1",
  amount: 500,
  failure_reason: null,
};

describe("GET /api/payments/status", () => {
  beforeEach(() => {
    settlePaymentIntent.mockReset();
    checkStatus.mockReset();
    storedIntent = { ...pendingIntent };
  });

  it("règle l'intention quand la passerelle dit que le paiement a abouti", async () => {
    checkStatus.mockResolvedValue({ status: "succeeded", amount: 500 });
    settlePaymentIntent.mockResolvedValue("succeeded");

    const body = await (await GET(get())).json();

    expect(checkStatus).toHaveBeenCalledWith("CP-TX-1");
    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "OREN-EXP-1", status: "succeeded" }),
      expect.anything(),
    );
    expect(body.status).toBe("succeeded");
  });

  it("remonte le motif d'échec de l'opérateur au client", async () => {
    checkStatus.mockResolvedValue({
      status: "failed",
      amount: 500,
      failureReason: "Le solde du compte du payeur est insuffisant",
      failureCode: "60019",
    });
    settlePaymentIntent.mockResolvedValue("failed");

    const body = await (await GET(get())).json();

    expect(body.status).toBe("failed");
    expect(body.failureReason).toBe(
      "Le solde du compte du payeur est insuffisant",
    );
    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: "60019" }),
      expect.anything(),
    );
  });

  it("refuse de confirmer un montant qui ne correspond pas à l'intention", async () => {
    checkStatus.mockResolvedValue({ status: "succeeded", amount: 100 });
    settlePaymentIntent.mockResolvedValue("failed");

    const body = await (await GET(get())).json();

    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureCode: "AMOUNT_MISMATCH" }),
      expect.anything(),
    );
    expect(body.status).toBe("failed");
  });

  it("reste en attente si la passerelle n'a pas tranché", async () => {
    checkStatus.mockResolvedValue({ status: "pending" });

    const body = await (await GET(get())).json();

    expect(settlePaymentIntent).not.toHaveBeenCalled();
    expect(body.status).toBe("pending");
  });

  it("reste en attente si l'état n'est pas lisible (réseau, config)", async () => {
    checkStatus.mockResolvedValue(null);

    const body = await (await GET(get())).json();

    expect(settlePaymentIntent).not.toHaveBeenCalled();
    expect(body.status).toBe("pending");
  });

  it("n'interroge pas la passerelle pour une intention déjà tranchée", async () => {
    storedIntent = { ...pendingIntent, status: "succeeded" };

    const body = await (await GET(get())).json();

    expect(checkStatus).not.toHaveBeenCalled();
    expect(body.status).toBe("succeeded");
  });

  it("n'interroge pas la passerelle sans référence de transaction", async () => {
    storedIntent = { ...pendingIntent, provider_reference: null };

    const body = await (await GET(get())).json();

    expect(checkStatus).not.toHaveBeenCalled();
    expect(body.status).toBe("pending");
  });

  it("n'interroge pas une passerelle qui n'a pas créé l'intention", async () => {
    storedIntent = { ...pendingIntent, provider: "simulated" };

    const body = await (await GET(get())).json();

    expect(checkStatus).not.toHaveBeenCalled();
    expect(body.status).toBe("pending");
  });

  it("laisse l'intention en attente si le règlement en base échoue", async () => {
    checkStatus.mockResolvedValue({ status: "succeeded", amount: 500 });
    settlePaymentIntent.mockRejectedValue(new Error("db down"));

    const body = await (await GET(get())).json();

    expect(body.status).toBe("pending");
  });

  it("répond 404 sur une référence inconnue", async () => {
    storedIntent = null;

    expect((await GET(get())).status).toBe(404);
  });
});

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settlePaymentIntent = vi.fn();
let intent: { amount: number; provider: string } | null = null;

vi.mock("@/services/payments", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: intent }) }) }),
    }),
  }),
  settlePaymentIntent: (...args: unknown[]) => settlePaymentIntent(...args),
}));

const { POST } = await import("./route");
const TOKEN = "long-secret-token";
const SERVICE = "service_test";

function request(fields: Record<string, string>, token = TOKEN) {
  return new NextRequest(`http://localhost/api/payments/webhook/monetbil?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

function event(overrides: Record<string, string> = {}) {
  return {
    service: SERVICE,
    transaction_id: "MB-123",
    transaction_uuid: "MB-uuid-123",
    payment_ref: "OREN-EXP-001",
    amount: "500",
    status: "success",
    ...overrides,
  };
}

describe("POST /api/payments/webhook/monetbil", () => {
  const oldToken = process.env.MONETBIL_NOTIFY_TOKEN;
  const oldService = process.env.MONETBIL_SERVICE_KEY;

  beforeEach(() => {
    process.env.MONETBIL_NOTIFY_TOKEN = TOKEN;
    process.env.MONETBIL_SERVICE_KEY = SERVICE;
    intent = { amount: 500, provider: "monetbil" };
    settlePaymentIntent.mockReset();
    settlePaymentIntent.mockResolvedValue("succeeded");
  });

  afterEach(() => {
    if (oldToken === undefined) delete process.env.MONETBIL_NOTIFY_TOKEN;
    else process.env.MONETBIL_NOTIFY_TOKEN = oldToken;
    if (oldService === undefined) delete process.env.MONETBIL_SERVICE_KEY;
    else process.env.MONETBIL_SERVICE_KEY = oldService;
  });

  it("regle uniquement une notification autorisee", async () => {
    const response = await POST(request(event()));
    expect(response.status).toBe(200);
    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "OREN-EXP-001",
        providerReference: "MB-uuid-123",
        status: "succeeded",
      }),
      expect.anything(),
    );
  });

  it("rejette un token inconnu", async () => {
    const response = await POST(request(event(), "wrong"));
    expect(response.status).toBe(401);
    expect(settlePaymentIntent).not.toHaveBeenCalled();
  });

  it("rejette un service different", async () => {
    const response = await POST(request(event({ service: "other" })));
    expect(response.status).toBe(401);
  });

  it("refuse un montant different", async () => {
    settlePaymentIntent.mockResolvedValue("failed");
    const response = await POST(request(event({ amount: "100" })));
    expect(response.status).toBe(200);
    expect(settlePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureCode: "AMOUNT_MISMATCH" }),
      expect.anything(),
    );
  });
});

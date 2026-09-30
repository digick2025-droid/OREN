import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonetbilProvider } from "./provider";

const ENV = ["MONETBIL_SERVICE_KEY", "MONETBIL_NOTIFY_URL", "MONETBIL_RETURN_URL"] as const;
const input = {
  reference: "OREN-EXP-abc123",
  amount: 500,
  currency: "XAF",
  method: "orange_money" as const,
  phone: "+237699123456",
  purpose: "express_document" as const,
};

describe("MonetbilProvider", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV) original[key] = process.env[key];
    process.env.MONETBIL_SERVICE_KEY = "service_test";
    process.env.MONETBIL_NOTIFY_URL = "https://oren.app/api/payments/webhook/monetbil?token=secret";
    process.env.MONETBIL_RETURN_URL = "https://oren.app/paiement/retour";
  });

  afterEach(() => {
    for (const key of ENV) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    vi.unstubAllGlobals();
  });

  it("cree un Widget Monetbil avec le moyen et le numero choisis", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, payment_url: "https://api.monetbil.com/pay/v2.1/test" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MonetbilProvider().initiate(input);

    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.monetbil.com/widget/v2.1/service_test");
    const body = fetchMock.mock.calls[0]![1].body as URLSearchParams;
    expect(body.get("phone")).toBe("237699123456");
    expect(body.get("operator")).toBe("CM_ORANGEMONEY");
    expect(body.get("payment_ref")).toBe(input.reference);
    expect(body.get("return_url")).toBe("https://oren.app/paiement/retour?ref=OREN-EXP-abc123");
    expect(result).toEqual({
      accepted: true,
      status: "pending",
      providerReference: input.reference,
      redirectUrl: "https://api.monetbil.com/pay/v2.1/test",
    });
  });

  it("preselectionne MTN MoMo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, payment_url: "https://pay.example" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await new MonetbilProvider().initiate({ ...input, method: "mtn_momo", phone: "699123456" });

    const body = fetchMock.mock.calls[0]![1].body as URLSearchParams;
    expect(body.get("operator")).toBe("CM_MTNMOBILEMONEY");
    expect(body.get("phone")).toBe("237699123456");
  });

  it("refuse une reponse sans URL de paiement", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: true }),
    }));
    expect((await new MonetbilProvider().initiate(input)).error).toBe("PROVIDER_NO_PAY_URL");
  });

  it("remonte le refus HTTP et son message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 401, json: async () => ({ message: "Service inconnu" }),
    }));
    expect((await new MonetbilProvider().initiate(input)).error).toBe("PROVIDER_HTTP_401: Service inconnu");
  });
});

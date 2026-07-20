import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CamerPayProvider } from "./provider";

const ENV_KEYS = [
  "CAMERPAY_API_URL",
  "CAMERPAY_API_KEY",
  "CAMERPAY_CALLBACK_URL",
  "CAMERPAY_RETURN_URL",
] as const;

const baseInput = {
  reference: "OREN-EXP-abc123",
  amount: 500,
  currency: "XAF",
  method: "orange_money" as const,
  phone: "+237699123456",
  purpose: "express_document" as const,
};

function mockFetchOnce(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => response,
  });
}

describe("CamerPayProvider — URL de retour", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.CAMERPAY_API_URL = "https://camerpay.biz/api/payment/initiate";
    process.env.CAMERPAY_API_KEY = "test-key";
    process.env.CAMERPAY_CALLBACK_URL = "https://oren.app/api/payments/webhook";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    vi.unstubAllGlobals();
  });

  it("ajoute ?ref=<reference> à merchant_return_url", async () => {
    process.env.CAMERPAY_RETURN_URL = "https://oren.app/paiement/retour";
    const fetchMock = mockFetchOnce({
      success: true,
      transaction_uuid: "CP-1",
      pay_url: "https://camerpay.biz/pay/CP-1",
      status: "pending",
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CamerPayProvider();
    await provider.initiate(baseInput);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.merchant_return_url).toBe(
      "https://oren.app/paiement/retour?ref=OREN-EXP-abc123",
    );
  });

  it("préserve les paramètres existants de CAMERPAY_RETURN_URL", async () => {
    process.env.CAMERPAY_RETURN_URL = "https://oren.app/paiement/retour?lang=fr";
    const fetchMock = mockFetchOnce({
      success: true,
      transaction_uuid: "CP-2",
      pay_url: "https://camerpay.biz/pay/CP-2",
      status: "pending",
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CamerPayProvider();
    await provider.initiate(baseInput);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    const url = new URL(body.merchant_return_url as string);
    expect(url.searchParams.get("lang")).toBe("fr");
    expect(url.searchParams.get("ref")).toBe("OREN-EXP-abc123");
  });

  it("n'envoie pas merchant_return_url si CAMERPAY_RETURN_URL est absent", async () => {
    delete process.env.CAMERPAY_RETURN_URL;
    const fetchMock = mockFetchOnce({
      success: true,
      transaction_uuid: "CP-3",
      pay_url: "https://camerpay.biz/pay/CP-3",
      status: "pending",
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CamerPayProvider();
    await provider.initiate(baseInput);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.merchant_return_url).toBeUndefined();
  });

  it("retombe sur l'URL brute si CAMERPAY_RETURN_URL est mal formée", async () => {
    process.env.CAMERPAY_RETURN_URL = "not-a-valid-url";
    const fetchMock = mockFetchOnce({
      success: true,
      transaction_uuid: "CP-4",
      pay_url: "https://camerpay.biz/pay/CP-4",
      status: "pending",
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CamerPayProvider();
    await provider.initiate(baseInput);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.merchant_return_url).toBe("not-a-valid-url");
  });
});

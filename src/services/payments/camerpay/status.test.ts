import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CamerPayProvider } from "./provider";

/**
 * Lecture d'état côté passerelle (`GET /api/payment/{uuid}/status`).
 *
 * C'est le filet qui rattrape un webhook jamais reçu. Deux exigences :
 * conclure juste quand CamerPay a tranché, et ne RIEN conclure sinon —
 * un `null` laisse l'intention en attente, ce qui est toujours réparable ;
 * un faux « failed » ne l'est pas.
 */

const ENV_KEYS = [
  "CAMERPAY_API_URL",
  "CAMERPAY_API_KEY",
  "CAMERPAY_STATUS_URL",
] as const;

function mockFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    json: async () => response,
  });
}

describe("CamerPayProvider.checkStatus", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.CAMERPAY_API_URL = "https://camerpay.biz/api/payment/initiate";
    process.env.CAMERPAY_API_KEY = "test-key";
    delete process.env.CAMERPAY_STATUS_URL;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    vi.unstubAllGlobals();
  });

  it("déduit l'URL de statut de l'URL d'initiation et s'authentifie", async () => {
    const fetchMock = mockFetch({
      success: true,
      transaction: { uuid: "CP-1", status: "completed", amount: 500 },
    });
    vi.stubGlobal("fetch", fetchMock);

    await new CamerPayProvider().checkStatus("CP-1");

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://camerpay.biz/api/payment/CP-1/status",
    );
    const init = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe("Bearer test-key");
  });

  it("traduit `completed` en succès et remonte le montant réglé", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        success: true,
        transaction: { uuid: "CP-2", status: "completed", amount: "500.00" },
      }),
    );

    const result = await new CamerPayProvider().checkStatus("CP-2");

    expect(result).toEqual({
      status: "succeeded",
      amount: 500,
      failureReason: undefined,
      failureCode: undefined,
    });
  });

  it("remonte le motif d'échec renvoyé par l'opérateur", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        success: true,
        transaction: {
          uuid: "CP-3",
          status: "failed",
          amount: 500,
          failure_reason: "Le solde du compte du payeur est insuffisant",
          failure_code: "60019",
        },
      }),
    );

    const result = await new CamerPayProvider().checkStatus("CP-3");

    expect(result?.status).toBe("failed");
    expect(result?.failureReason).toBe(
      "Le solde du compte du payeur est insuffisant",
    );
    expect(result?.failureCode).toBe("60019");
  });

  it("laisse `processing` en attente : rien n'est tranché", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ transaction: { uuid: "CP-4", status: "processing" } }),
    );

    expect((await new CamerPayProvider().checkStatus("CP-4"))?.status).toBe(
      "pending",
    );
  });

  it("renvoie null sur erreur HTTP, réseau ou réponse illisible", async () => {
    const provider = new CamerPayProvider();

    vi.stubGlobal("fetch", mockFetch({ message: "Not found" }, false));
    expect(await provider.checkStatus("CP-5")).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await provider.checkStatus("CP-5")).toBeNull();

    vi.stubGlobal("fetch", mockFetch({ success: true }));
    expect(await provider.checkStatus("CP-5")).toBeNull();
  });

  it("n'appelle rien sans référence passerelle ni sans clé API", async () => {
    const fetchMock = mockFetch({ transaction: { status: "completed" } });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new CamerPayProvider();

    expect(await provider.checkStatus("")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.CAMERPAY_API_KEY = "";
    expect(await new CamerPayProvider().checkStatus("CP-6")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("respecte CAMERPAY_STATUS_URL quand l'endpoint est forcé", async () => {
    process.env.CAMERPAY_STATUS_URL = "https://camerpay.biz/api/tx/{uuid}/state";
    const fetchMock = mockFetch({ transaction: { status: "completed" } });
    vi.stubGlobal("fetch", fetchMock);

    await new CamerPayProvider().checkStatus("CP-7");

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://camerpay.biz/api/tx/CP-7/state",
    );
  });

  it("ne devine pas d'URL si l'initiation pointe ailleurs", async () => {
    process.env.CAMERPAY_API_URL = "https://camerpay.biz/api/v2/collect";
    const fetchMock = mockFetch({ transaction: { status: "completed" } });
    vi.stubGlobal("fetch", fetchMock);

    expect(await new CamerPayProvider().checkStatus("CP-8")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CamerPayProvider.initiate — contrat documenté", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.CAMERPAY_API_URL = "https://camerpay.biz/api/payment/initiate";
    process.env.CAMERPAY_API_KEY = "test-key";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    vi.unstubAllGlobals();
  });

  it("transmet le moyen de paiement choisi et le numéro en +237…", async () => {
    const fetchMock = mockFetch({
      success: true,
      transaction_uuid: "CP-9",
      pay_url: "https://camerpay.biz/pay/CP-9",
      status: "pending",
    });
    vi.stubGlobal("fetch", fetchMock);

    await new CamerPayProvider().initiate({
      reference: "OREN-EXP-1",
      amount: 500,
      currency: "XAF",
      method: "mtn_momo",
      phone: "699123456",
      purpose: "express_document",
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.payment_method).toBe("mtn_momo");
    expect(body.customer_phone).toBe("+237699123456");
  });

  it("n'ajoute pas deux fois l'indicatif d'un numéro déjà en E.164", async () => {
    const fetchMock = mockFetch({
      success: true,
      transaction_uuid: "CP-10",
      pay_url: "https://camerpay.biz/pay/CP-10",
      status: "pending",
    });
    vi.stubGlobal("fetch", fetchMock);

    await new CamerPayProvider().initiate({
      reference: "OREN-EXP-2",
      amount: 500,
      currency: "XAF",
      method: "orange_money",
      phone: "+237 699 12 34 56",
      purpose: "express_document",
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.customer_phone).toBe("+237699123456");
  });
});

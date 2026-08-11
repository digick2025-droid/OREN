import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KPayProvider } from "./provider";

/**
 * Initiation K-PAY en mode USSD : ce qui compte ici, c'est qu'aucune
 * `redirectUrl` ne soit jamais renvoyée (le client reste dans l'application)
 * et qu'un refus ne soit jamais confondu avec une attente.
 */

const ENV_KEYS = ["KPAY_API_URL", "KPAY_API_KEY", "KPAY_SECRET_KEY"] as const;

const baseInput = {
  reference: "OREN-EXP-abc123",
  amount: 500,
  currency: "XAF",
  method: "orange_money" as const,
  phone: "+237699123456",
  purpose: "express_document" as const,
};

function mockFetch(response: unknown, status = 201) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
  });
}

const accepted = {
  id: "pay_abc123",
  reference: "KPAY-20260729-ABC123",
  status: "PENDING",
  amount: 500,
};

describe("KPayProvider.initiate", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    delete process.env.KPAY_API_URL;
    process.env.KPAY_API_KEY = "kpay_test_key";
    process.env.KPAY_SECRET_KEY = "kpay_test_secret";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    vi.unstubAllGlobals();
  });

  it("pousse la demande sur le telephone sans aucune redirection", async () => {
    const fetchMock = mockFetch(accepted);
    vi.stubGlobal("fetch", fetchMock);

    const result = await new KPayProvider().initiate(baseInput);

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://admin.kpay.site/api/v1/payments/init",
    );
    expect(result).toEqual({
      accepted: true,
      status: "pending",
      providerReference: "KPAY-20260729-ABC123",
    });
    expect(result.redirectUrl).toBeUndefined();
  });

  it("authentifie par les deux en-tetes de cle", async () => {
    const fetchMock = mockFetch(accepted);
    vi.stubGlobal("fetch", fetchMock);

    await new KPayProvider().initiate(baseInput);

    const headers = (fetchMock.mock.calls[0]![1] as {
      headers: Record<string, string>;
    }).headers;
    expect(headers["X-API-Key"]).toBe("kpay_test_key");
    expect(headers["X-Secret-Key"]).toBe("kpay_test_secret");
  });

  it("route vers l'operateur choisi et normalise le numero", async () => {
    const fetchMock = mockFetch(accepted);
    vi.stubGlobal("fetch", fetchMock);

    await new KPayProvider().initiate({ ...baseInput, method: "mtn_momo" });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.provider).toBe("MTN_MOMO_CMR");
    expect(body.phoneNumber).toBe("237699123456");
    // Notre reference sert de cle d'idempotence cote K-PAY.
    expect(body.externalId).toBe("OREN-EXP-abc123");
  });

  it("complete un numero saisi en local", async () => {
    const fetchMock = mockFetch(accepted);
    vi.stubGlobal("fetch", fetchMock);

    await new KPayProvider().initiate({ ...baseInput, phone: "699123456" });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.phoneNumber).toBe("237699123456");
  });

  it("refuse la carte : le mode USSD exige un operateur Mobile Money", async () => {
    const fetchMock = mockFetch(accepted);
    vi.stubGlobal("fetch", fetchMock);

    const result = await new KPayProvider().initiate({
      ...baseInput,
      method: "card",
    });

    expect(result.error).toBe("METHOD_NOT_SUPPORTED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuse un numero incomplet sans appeler la passerelle", async () => {
    const fetchMock = mockFetch(accepted);
    vi.stubGlobal("fetch", fetchMock);

    const result = await new KPayProvider().initiate({
      ...baseInput,
      phone: "6991",
    });

    expect(result.error).toBe("INVALID_PHONE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("echoue proprement si les cles ne sont pas configurees", async () => {
    process.env.KPAY_API_KEY = "";
    const fetchMock = mockFetch(accepted);
    vi.stubGlobal("fetch", fetchMock);

    const result = await new KPayProvider().initiate(baseInput);

    expect(result.error).toBe("PROVIDER_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("remonte le code HTTP ET le message d'erreur de l'API sur un refus", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        { statusCode: 400, message: "amount must not be less than 50" },
        400,
      ),
    );

    const result = await new KPayProvider().initiate(baseInput);

    expect(result.accepted).toBe(false);
    // Le code HTTP en tete : c'est lui qui dit s'il faut corriger nos cles,
    // notre charge utile ou attendre. Le message de l'API suit, pour le detail.
    expect(result.error).toBe(
      "PROVIDER_HTTP_400: amount must not be less than 50",
    );
  });

  it("garde le code HTTP meme quand l'API ne joint aucun message", async () => {
    vi.stubGlobal("fetch", mockFetch({ statusCode: 401 }, 401));

    const result = await new KPayProvider().initiate(baseInput);

    expect(result.error).toBe("PROVIDER_HTTP_401");
  });

  it("distingue un externalId deja utilise (409) d'un echec de paiement", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ statusCode: 409, message: "already exists" }, 409),
    );

    const result = await new KPayProvider().initiate(baseInput);

    expect(result.error).toBe("DUPLICATE_REFERENCE");
  });

  it("signale une passerelle injoignable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await new KPayProvider().initiate(baseInput);

    expect(result.error).toBe("PROVIDER_UNREACHABLE");
  });

  it("refuse une reponse 201 sans reference exploitable", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: "PENDING" }));

    const result = await new KPayProvider().initiate(baseInput);

    expect(result.error).toBe("PROVIDER_BAD_RESPONSE");
  });
});

describe("KPayProvider.checkStatus", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.KPAY_API_KEY = "kpay_test_key";
    process.env.KPAY_SECRET_KEY = "kpay_test_secret";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    vi.unstubAllGlobals();
  });

  it("interroge la transaction par sa reference", async () => {
    const fetchMock = mockFetch(
      { status: "COMPLETED", amount: 500 },
      200,
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new KPayProvider().checkStatus("KPAY-20260729-ABC123");

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://admin.kpay.site/api/v1/payments/KPAY-20260729-ABC123",
    );
    expect(result?.status).toBe("succeeded");
    // Le montant demande, pas le net encaisse : c'est lui qu'on compare.
    expect(result?.amount).toBe(500);
  });

  it("remonte le motif d'echec de l'operateur", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        {
          status: "FAILED",
          amount: 500,
          netAmount: 490,
          failureReason: "Solde insuffisant",
        },
        200,
      ),
    );

    const result = await new KPayProvider().checkStatus("KPAY-1");

    expect(result?.status).toBe("failed");
    expect(result?.failureReason).toBe("Solde insuffisant");
  });

  it("traite une annulation client comme un echec identifie", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: "CANCELLED", amount: 500 }, 200));

    const result = await new KPayProvider().checkStatus("KPAY-2");

    expect(result?.status).toBe("failed");
    expect(result?.failureCode).toBe("CANCELLED");
  });

  it("laisse PROCESSING en attente : rien n'est tranche", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: "PROCESSING" }, 200));

    expect((await new KPayProvider().checkStatus("KPAY-3"))?.status).toBe(
      "pending",
    );
  });

  it("renvoie null sur erreur HTTP, reseau ou reponse illisible", async () => {
    const provider = new KPayProvider();

    vi.stubGlobal("fetch", mockFetch({ statusCode: 404 }, 404));
    expect(await provider.checkStatus("KPAY-4")).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await provider.checkStatus("KPAY-4")).toBeNull();

    vi.stubGlobal("fetch", mockFetch({ id: "pay_1" }, 200));
    expect(await provider.checkStatus("KPAY-4")).toBeNull();
  });
});

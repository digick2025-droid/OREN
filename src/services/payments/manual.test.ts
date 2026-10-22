import { describe, expect, it } from "vitest";
import { ManualPaymentProvider } from "./manual";

const base = {
  reference: "OREN-DOC-1",
  amount: 500,
  currency: "XAF",
  purpose: "document_credit" as const,
};

describe("ManualPaymentProvider", () => {
  const provider = new ManualPaymentProvider();

  it("règle tout de suite avec la référence SMS normalisée", async () => {
    const result = await provider.initiate({
      ...base,
      method: "mtn_momo",
      transactionRef: "9876 5432 101",
    });
    expect(result).toEqual({
      accepted: true,
      status: "succeeded",
      providerReference: "98765432101",
    });
  });

  it("refuse une référence absente ou invalide", async () => {
    const result = await provider.initiate({ ...base, method: "orange_money" });
    expect(result).toMatchObject({ accepted: false, error: "INVALID_TRANSACTION_REF" });
  });

  it("refuse la carte bancaire", async () => {
    const result = await provider.initiate({
      ...base,
      method: "card",
      transactionRef: "98765432101",
    });
    expect(result).toMatchObject({ accepted: false, error: "METHOD_NOT_SUPPORTED" });
  });
});

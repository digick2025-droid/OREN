import type { PaymentProvider, PaymentRequest, PaymentResult } from "./types";

/**
 * Fournisseur simulé (MVP) : accepte tout paiement après un court délai,
 * comme le ferait une confirmation Mobile Money.
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = "simulated";

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    if (
      (request.method === "orange_money" || request.method === "mtn_momo") &&
      !(request.phone && request.phone.replace(/[^\d]/g, "").length >= 8)
    ) {
      return {
        success: false,
        reference: "",
        error: "INVALID_PHONE",
      };
    }
    if (request.amount <= 0) {
      return { success: false, reference: "", error: "INVALID_AMOUNT" };
    }

    // Latence réaliste d'une validation Mobile Money
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      success: true,
      reference: `SIM-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    };
  }
}

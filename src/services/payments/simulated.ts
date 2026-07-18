import type {
  PaymentProvider,
  PaymentIntentInput,
  PaymentInitiation,
} from "./types";

/**
 * Fournisseur simulé (MVP) : règle le paiement de façon **synchrone**,
 * comme une confirmation Mobile Money instantanée. Il renvoie donc
 * `status: "succeeded"` dès l'initiation ; l'appelant confirme sans
 * attendre de webhook.
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = "simulated";

  async initiate(input: PaymentIntentInput): Promise<PaymentInitiation> {
    if (
      (input.method === "orange_money" || input.method === "mtn_momo") &&
      !(input.phone && input.phone.replace(/[^\d]/g, "").length >= 8)
    ) {
      return {
        accepted: false,
        status: "failed",
        providerReference: "",
        error: "INVALID_PHONE",
      };
    }
    if (input.amount <= 0) {
      return {
        accepted: false,
        status: "failed",
        providerReference: "",
        error: "INVALID_AMOUNT",
      };
    }

    // Latence réaliste d'une validation Mobile Money.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      accepted: true,
      status: "succeeded",
      providerReference: `SIM-${Date.now()}-${Math.floor(
        Math.random() * 10000,
      )}`,
    };
  }
}

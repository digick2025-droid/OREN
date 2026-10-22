import { normalizeTransactionRef } from "@/lib/manual-payment";
import type {
  PaymentProvider,
  PaymentIntentInput,
  PaymentInitiation,
} from "./types";

/**
 * Paiement manuel : le client a déjà envoyé l'argent au numéro marchand et
 * déclare la référence reçue par SMS. Le règlement est **synchrone** (comme
 * le simulateur) : la route confirme tout de suite par le même chemin que
 * le webhook, et l'intention reste « à vérifier » pour l'admin (0039).
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = "manual";

  async initiate(input: PaymentIntentInput): Promise<PaymentInitiation> {
    if (input.method !== "orange_money" && input.method !== "mtn_momo") {
      return { accepted: false, status: "failed", providerReference: "", error: "METHOD_NOT_SUPPORTED" };
    }
    const ref = normalizeTransactionRef(input.transactionRef);
    if (!ref) {
      return { accepted: false, status: "failed", providerReference: "", error: "INVALID_TRANSACTION_REF" };
    }
    if (input.amount <= 0) {
      return { accepted: false, status: "failed", providerReference: "", error: "INVALID_AMOUNT" };
    }
    return { accepted: true, status: "succeeded", providerReference: ref };
  }
}

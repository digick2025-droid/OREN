import { SimulatedPaymentProvider } from "./simulated";
import { CamerPayProvider } from "./camerpay/provider";
import type { PaymentProvider } from "./types";

/**
 * Sélection du fournisseur via PAYMENT_PROVIDER (env, côté serveur).
 *   - "simulated" (défaut MVP) : règle de façon synchrone.
 *   - "camerpay"               : Mobile Money réel, confirmé par webhook signé.
 */
export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER ?? "simulated";
  switch (provider) {
    case "camerpay":
      return new CamerPayProvider();
    case "simulated":
    default:
      return new SimulatedPaymentProvider();
  }
}

export { settlePaymentIntent } from "./confirm";
export { createServiceClient } from "./supabase";
export { verifyWebhookSignature } from "./camerpay/signature";

export type {
  PaymentProvider,
  PaymentIntentInput,
  PaymentInitiation,
  PaymentWebhookEvent,
  PaymentPurpose,
  PaymentStatus,
} from "./types";

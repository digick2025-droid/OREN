import { SimulatedPaymentProvider } from "./simulated";
import { CamerPayProvider } from "./camerpay/provider";
import { KPayProvider } from "./kpay/provider";
import { MonetbilProvider } from "./monetbil/provider";
import type { PaymentProvider } from "./types";

/**
 * Sélection du fournisseur via PAYMENT_PROVIDER (env, côté serveur).
 *   - "simulated" (défaut MVP) : règle de façon synchrone.
 *   - "kpay"                   : Mobile Money SANS quitter l'application
 *                                (demande poussée sur le téléphone du client).
 *   - "monetbil"               : Mobile Money par redirection Monetbil.
 *   - "camerpay"               : Mobile Money par redirection vers leur page.
 *
 * La bascule est une simple variable d'environnement : les intentions déjà
 * créées gardent en base le nom du fournisseur qui les a initiées, et la
 * réconciliation refuse d'interroger une passerelle qui n'est pas la leur.
 */
export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER ?? "simulated";
  switch (provider) {
    case "kpay":
      return new KPayProvider();
    case "monetbil":
      return new MonetbilProvider();
    case "camerpay":
      return new CamerPayProvider();
    case "simulated":
    default:
      return new SimulatedPaymentProvider();
  }
}

export { settlePaymentIntent } from "./confirm";
export { createServiceClient } from "./supabase";
export {
  parseCallback,
  verifyCallbackSignature,
} from "./camerpay/signature";

export type {
  PaymentProvider,
  PaymentIntentInput,
  PaymentInitiation,
  PaymentWebhookEvent,
  PaymentPurpose,
  PaymentStatus,
} from "./types";

import { SimulatedPaymentProvider } from "./simulated";
import type { PaymentProvider } from "./types";

/**
 * Sélection du fournisseur via PAYMENT_PROVIDER (env, côté serveur).
 * Ajouter CamerPay : créer camerpay.ts implémentant PaymentProvider
 * et l'enregistrer ici.
 */
export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER ?? "simulated";
  switch (provider) {
    case "simulated":
    default:
      return new SimulatedPaymentProvider();
  }
}

export type {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from "./types";

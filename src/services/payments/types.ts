/**
 * Passerelle de paiement — interface remplaçable.
 * Le MVP utilise SimulatedPaymentProvider ; CamerPay s'ajoutera en
 * implémentant PaymentProvider, sans toucher aux composants.
 */

import type { PaymentMethod } from "@/types/database";

export interface PaymentRequest {
  /** Montant en FCFA */
  amount: number;
  method: PaymentMethod;
  /** Numéro Mobile Money (requis pour orange_money / mtn_momo) */
  phone?: string;
  /** Ce que paie l'utilisateur */
  purpose: "subscription" | "express_document";
  /** Clé de l'offre (pour un abonnement) */
  planKey?: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  /** Référence unique de la transaction chez le fournisseur */
  reference: string;
  error?: string;
}

export interface PaymentProvider {
  readonly name: string;
  charge(request: PaymentRequest): Promise<PaymentResult>;
}

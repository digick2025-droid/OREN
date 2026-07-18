import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase";
import type { PaymentWebhookEvent } from "./types";

/**
 * Confirme (ou marque échouée) une intention de paiement, de façon
 * **idempotente** et **atomique**, via la fonction SQL `settle_payment_intent`
 * (SECURITY DEFINER, réservée au service role).
 *
 * C'est l'UNIQUE chemin qui insère dans `payments` et applique le changement
 * de plan. Il est appelé :
 *   1. par le webhook signé CamerPay (source de vérité) ;
 *   2. par l'endpoint d'initiation UNIQUEMENT pour les fournisseurs qui règlent
 *      de façon synchrone (simulateur), afin de garder le flux dev fonctionnel.
 *
 * @returns le statut final de l'intention ("succeeded" | "failed" | "pending"),
 *          ou null si l'intention est introuvable.
 */
export async function settlePaymentIntent(
  event: PaymentWebhookEvent,
  client?: SupabaseClient,
): Promise<"succeeded" | "failed" | "pending" | null> {
  const supabase = client ?? createServiceClient();

  const { data, error } = await supabase.rpc("settle_payment_intent", {
    p_reference: event.reference,
    p_status: event.status,
    p_provider_reference: event.providerReference,
  });

  if (error) {
    // "INTENT_NOT_FOUND" est renvoyé comme exception SQL → on le neutralise
    // en null pour laisser l'appelant décider (404 côté webhook).
    if (error.message?.includes("INTENT_NOT_FOUND")) return null;
    throw error;
  }

  return (data as "succeeded" | "failed" | "pending" | null) ?? null;
}

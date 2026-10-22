"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface AdminPaymentIntentListItem {
  id: string;
  reference: string;
  provider: string;
  purpose: "subscription" | "express_document" | "document_credit";
  company_id: string | null;
  company_name: string | null;
  plan_key: string | null;
  amount: number;
  discount_fcfa: number;
  method: string;
  status: "pending" | "succeeded" | "failed";
  /** Pourquoi ça a échoué — refus de l'opérateur ou refus de la passerelle. */
  failure_reason: string | null;
  settled_at: string | null;
  created_at: string;
  /** Paiement manuel : référence recopiée du SMS et numéro payeur. */
  transaction_ref: string | null;
  phone: string | null;
  /** Paiement manuel : contrôle a posteriori par l'admin (0039). */
  review_status: "to_review" | "confirmed" | "rejected" | null;
}

export function useAdminPaymentIntents() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-payment-intents"],
    queryFn: async (): Promise<AdminPaymentIntentListItem[]> => {
      const { data, error } = await supabase
        .from("payment_intents")
        .select(
          "id, reference, provider, purpose, company_id, plan_key, amount, discount_fcfa, method, status, failure_reason, settled_at, created_at, transaction_ref, phone, review_status, companies(name)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (
        data as unknown as Array<
          Omit<AdminPaymentIntentListItem, "company_name"> & {
            companies: { name: string } | null;
          }
        >
      ).map(({ companies, ...rest }) => ({
        ...rest,
        company_name: companies?.name ?? null,
      }));
    },
  });
}

/**
 * Confirme ou annule un paiement manuel. L'annulation retire ce qui avait
 * été débloqué (abonnement → gratuit, documents achetés retirés).
 */
export function useReviewManualPayment() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      reference: string;
      decision: "confirmed" | "rejected";
    }) => {
      const { data, error } = await supabase.rpc("admin_review_manual_payment", {
        p_reference: input.reference,
        p_decision: input.decision,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-payment-intents"] });
    },
  });
}

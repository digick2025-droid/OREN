"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface AdminPaymentIntentListItem {
  id: string;
  reference: string;
  provider: string;
  purpose: "subscription" | "express_document";
  company_id: string | null;
  company_name: string | null;
  plan_key: string | null;
  amount: number;
  discount_fcfa: number;
  method: string;
  status: "pending" | "succeeded" | "failed";
  settled_at: string | null;
  created_at: string;
}

export function useAdminPaymentIntents() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-payment-intents"],
    queryFn: async (): Promise<AdminPaymentIntentListItem[]> => {
      const { data, error } = await supabase
        .from("payment_intents")
        .select(
          "id, reference, provider, purpose, company_id, plan_key, amount, discount_fcfa, method, status, settled_at, created_at, companies(name)",
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

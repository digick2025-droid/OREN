"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface AdminStats {
  active_subscriptions_by_plan: Record<string, number>;
  mrr_fcfa: number;
  revenue_30d_fcfa: number;
  revenue_total_fcfa: number;
  companies_total: number;
  companies_30d: number;
  documents_30d: number;
  documents_total: number;
  payment_intents_pending: number;
  payment_intents_failed_7d: number;
  companies_suspended: number;
}

export function useAdminStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<AdminStats> => {
      const { data, error } = await supabase.rpc("admin_get_stats");
      if (error) throw new Error(error.message);
      return data as AdminStats;
    },
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

interface TimingStats {
  count: number;
  median_seconds: number | null;
  under_2_min: number;
}

export interface AdminFunnelStats {
  days: number;
  /** Appareils distincts par événement sur la période. */
  steps: Record<string, number>;
  /** Inscription ouverte → premier document envoyé, par appareil. */
  signup_to_first_share: TimingStats;
  /** Ouverture du formulaire → « Générer », par document. */
  build_time: TimingStats;
}

export function useAdminFunnel(days: number) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-funnel", days],
    queryFn: async (): Promise<AdminFunnelStats> => {
      const { data, error } = await supabase.rpc("admin_funnel_stats", {
        p_days: days,
      });
      if (error) throw new Error(error.message);
      return data as AdminFunnelStats;
    },
  });
}

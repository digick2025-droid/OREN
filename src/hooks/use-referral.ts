"use client";

import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type { ReferralInfo } from "@/types/database";

export function useReferralInfo() {
  const company = useCompany();
  const supabase = createClient();

  return useQuery({
    queryKey: ["referral", company.id],
    queryFn: async (): Promise<ReferralInfo> => {
      const { data, error } = await supabase.rpc("get_referral_info", {
        p_company_id: company.id,
      });
      if (error) throw new Error(error.message);
      return data as ReferralInfo;
    },
  });
}

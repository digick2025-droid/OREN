"use client";

import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type { Plan, PlanFeature, Usage } from "@/types/database";

export function useUsage() {
  const company = useCompany();
  const supabase = createClient();

  return useQuery({
    queryKey: ["usage", company.id],
    queryFn: async (): Promise<Usage> => {
      const { data, error } = await supabase.rpc("get_usage", {
        p_company_id: company.id,
      });
      if (error) throw new Error(error.message);
      return data as Usage;
    },
  });
}

/**
 * Vérifie si l'offre active donne accès à une fonctionnalité.
 * Retourne aussi loading pour éviter d'afficher le verrou avant de savoir.
 */
export function usePlanFeature(feature: PlanFeature): {
  enabled: boolean;
  loading: boolean;
} {
  const { data: usage, isLoading } = useUsage();
  return {
    enabled: usage?.features.includes(feature) ?? false,
    loading: isLoading,
  };
}

export function usePlans() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["plans"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Plan[];
    },
  });
}

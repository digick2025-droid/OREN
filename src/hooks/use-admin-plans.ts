"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Plan, PlanFeature, PlanMarketing } from "@/types/database";

/** Toutes les offres (actives ou non) — admin uniquement (plans_select_admin). */
export function useAdminPlans() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as Plan[];
    },
  });
}

export interface UpdatePlanInput {
  name?: string;
  price_fcfa?: number;
  monthly_quota?: number | null;
  per_document_price_fcfa?: number | null;
  features?: PlanFeature[];
  marketing?: PlanMarketing;
  is_active?: boolean;
}

export function useUpdatePlan() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { key: string; values: UpdatePlanInput }): Promise<Plan> => {
      const { data, error } = await supabase
        .from("plans")
        .update(input.values)
        .eq("key", input.key)
        .select()
        .single();
      if (error) throw error;
      return data as Plan;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      // Le contenu marketing/prix des offres est aussi lu côté /offres public.
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

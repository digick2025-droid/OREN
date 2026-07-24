"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Company, Payment, Plan, Subscription } from "@/types/database";

export interface AdminCompanyListItem {
  company_id: string;
  name: string;
  owner_phone: string | null;
  plan_key: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  usage_used: number;
  usage_quota: number | null;
  last_payment_fcfa: number | null;
  last_payment_at: string | null;
  last_sign_in_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
}

/** Ligne `payment_intents` (miroir de la migration 0016/0018). */
export interface AdminPaymentIntentRow {
  id: string;
  reference: string;
  provider: string;
  provider_reference: string;
  purpose: "subscription" | "express_document";
  company_id: string | null;
  plan_key: string | null;
  amount: number;
  currency: string;
  method: string;
  phone: string | null;
  status: "pending" | "succeeded" | "failed";
  payment_id: string | null;
  promo_code_id: string | null;
  discount_fcfa: number;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminCompanyDetail {
  company: Company;
  last_sign_in_at: string | null;
  banned_until: string | null;
  subscription: Subscription | null;
  plan: Plan | null;
  usage_used: number;
  payments: Payment[];
  payment_intents: AdminPaymentIntentRow[];
}

export function useAdminCompanies() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-companies"],
    queryFn: async (): Promise<AdminCompanyListItem[]> => {
      const { data, error } = await supabase.rpc("admin_list_companies");
      if (error) throw new Error(error.message);
      return data as AdminCompanyListItem[];
    },
  });
}

export function useAdminCompanyDetail(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-company-detail", companyId],
    queryFn: async (): Promise<AdminCompanyDetail> => {
      const { data, error } = await supabase.rpc("admin_get_company_detail", {
        p_company_id: companyId,
      });
      if (error) throw new Error(error.message);
      return data as AdminCompanyDetail;
    },
    enabled: Boolean(companyId),
  });
}

export function useAdminChangePlan() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { companyId: string; planKey: string }) => {
      const { error } = await supabase.rpc("admin_change_plan", {
        p_company_id: input.companyId,
        p_plan_key: input.planKey,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-company-detail", input.companyId],
      });
    },
  });
}

export function useAdminSetSuspended() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      companyId: string;
      suspended: boolean;
      reason: string | null;
    }) => {
      const { error } = await supabase.rpc("admin_set_company_suspended", {
        p_company_id: input.companyId,
        p_suspended: input.suspended,
        p_reason: input.reason,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-company-detail", input.companyId],
      });
    },
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type PromoDiscountType = "percent" | "fixed";

export interface PromoCode {
  id: string;
  code: string;
  description: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  applicable_plans: string[] | null;
  max_redemptions: number | null;
  redemption_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  batch_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useAdminPromoCodes() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-promo-codes"],
    queryFn: async (): Promise<PromoCode[]> => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PromoCode[];
    },
  });
}

export function useAdminPromoCode(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-promo-code", id],
    queryFn: async (): Promise<PromoCode> => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as PromoCode;
    },
    enabled: Boolean(id),
  });
}

export interface CreatePromoCodeInput {
  code: string;
  description: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  applicable_plans: string[] | null;
  max_redemptions: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export function useCreatePromoCode() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePromoCodeInput): Promise<PromoCode> => {
      const { data, error } = await supabase
        .from("promo_codes")
        .insert({ ...input, code: input.code.trim().toUpperCase() })
        .select()
        .single();
      if (error) throw error;
      return data as PromoCode;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
  });
}

export function useUpdatePromoCode() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      values: Partial<CreatePromoCodeInput>;
    }): Promise<PromoCode> => {
      const { data, error } = await supabase
        .from("promo_codes")
        .update(input.values)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as PromoCode;
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-promo-code", input.id],
      });
    },
  });
}

export interface BulkCreatePromoCodesInput {
  prefix: string;
  count: number;
  discount_type: PromoDiscountType;
  discount_value: number;
  applicable_plans: string[] | null;
  expires_at: string | null;
}

export function useBulkCreatePromoCodes() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BulkCreatePromoCodesInput): Promise<PromoCode[]> => {
      const { data, error } = await supabase.rpc("admin_bulk_create_promo_codes", {
        p_prefix: input.prefix,
        p_count: input.count,
        p_discount_type: input.discount_type,
        p_discount_value: input.discount_value,
        p_applicable_plans: input.applicable_plans,
        p_expires_at: input.expires_at,
      });
      if (error) throw new Error(error.message);
      return data as PromoCode[];
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
  });
}

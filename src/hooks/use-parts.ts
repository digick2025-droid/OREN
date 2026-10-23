"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type { Part, PartInsert, PartUpdate } from "@/types/database";

/** Magasin de l'entreprise : pièces détachées non supprimées. */
export function useParts() {
  const company = useCompany();
  const supabase = createClient();
  return useQuery({
    queryKey: ["parts", company.id],
    queryFn: async (): Promise<Part[]> => {
      const { data, error } = await supabase
        .from("parts")
        .select("*")
        .eq("company_id", company.id)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data as Part[];
    },
  });
}

export function useSavePart() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      values: Omit<PartInsert, "company_id">;
    }): Promise<Part> => {
      if (input.id) {
        const update: PartUpdate = input.values;
        const { data, error } = await supabase
          .from("parts")
          .update(update)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data as Part;
      }
      const insert: PartInsert = { ...input.values, company_id: company.id };
      const { data, error } = await supabase
        .from("parts")
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return data as Part;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["parts", company.id] });
    },
  });
}

/** Réajuste le stock d'une pièce (réception, inventaire) par un delta. */
export function useAdjustStock() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      stock,
    }: {
      id: string;
      stock: number;
    }): Promise<void> => {
      const { error } = await supabase
        .from("parts")
        .update({ stock })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["parts", company.id] });
    },
  });
}

export function useDeletePart() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("parts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["parts", company.id] });
    },
  });
}

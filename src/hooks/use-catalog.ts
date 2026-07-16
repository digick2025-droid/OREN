"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type {
  CatalogItem,
  CatalogItemInsert,
  CatalogItemUpdate,
} from "@/types/database";

export function useCatalog() {
  const company = useCompany();
  const supabase = createClient();

  return useQuery({
    queryKey: ["catalog", company.id],
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .eq("company_id", company.id)
        .is("deleted_at", null)
        .order("is_favorite", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as CatalogItem[];
    },
  });
}

export function useSaveCatalogItem() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id?: string;
      values: Omit<CatalogItemInsert, "company_id">;
    }): Promise<CatalogItem> => {
      if (input.id) {
        const update: CatalogItemUpdate = input.values;
        const { data, error } = await supabase
          .from("catalog_items")
          .update(update)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data as CatalogItem;
      }
      const insert: CatalogItemInsert = {
        ...input.values,
        company_id: company.id,
      };
      const { data, error } = await supabase
        .from("catalog_items")
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return data as CatalogItem;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", company.id] });
    },
  });
}

export function useDeleteCatalogItem() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("catalog_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", company.id] });
    },
  });
}

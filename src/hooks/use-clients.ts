"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type { Client, ClientInsert, ClientUpdate } from "@/types/database";

export function useClients() {
  const company = useCompany();
  const supabase = createClient();

  return useQuery({
    queryKey: ["clients", company.id],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("company_id", company.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useSaveClient() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id?: string;
      values: Omit<ClientInsert, "company_id">;
    }): Promise<Client> => {
      if (input.id) {
        const update: ClientUpdate = input.values;
        const { data, error } = await supabase
          .from("clients")
          .update(update)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data as Client;
      }
      const insert: ClientInsert = { ...input.values, company_id: company.id };
      const { data, error } = await supabase
        .from("clients")
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clients", company.id] });
    },
  });
}

export function useDeleteClient() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("clients")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clients", company.id] });
    },
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type {
  MaintenanceContract,
  MaintenanceContractInsert,
  MaintenanceContractUpdate,
} from "@/types/database";

export function useContracts() {
  const company = useCompany();
  const supabase = createClient();
  return useQuery({
    queryKey: ["contracts", company.id],
    queryFn: async (): Promise<MaintenanceContract[]> => {
      const { data, error } = await supabase
        .from("maintenance_contracts")
        .select("*")
        .eq("company_id", company.id)
        .is("deleted_at", null)
        .order("next_due", { ascending: true });
      if (error) throw error;
      return data as MaintenanceContract[];
    },
  });
}

export function useContract(id: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["contract", id],
    queryFn: async (): Promise<MaintenanceContract | null> => {
      const { data, error } = await supabase
        .from("maintenance_contracts")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return (data as MaintenanceContract) ?? null;
    },
  });
}

export function useSaveContract() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | { id: string; values: MaintenanceContractUpdate }
        | { values: Omit<MaintenanceContractInsert, "company_id"> },
    ): Promise<MaintenanceContract> => {
      if ("id" in input) {
        const { data, error } = await supabase
          .from("maintenance_contracts")
          .update(input.values)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data as MaintenanceContract;
      }
      const insert: MaintenanceContractInsert = {
        ...input.values,
        company_id: company.id,
      };
      const { data, error } = await supabase
        .from("maintenance_contracts")
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return data as MaintenanceContract;
    },
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ["contracts", company.id] });
      void queryClient.invalidateQueries({ queryKey: ["contract", row.id] });
    },
  });
}

export function useDeleteContract() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("maintenance_contracts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contracts", company.id] });
    },
  });
}

/** Génère l'intervention de l'échéance et avance next_due (RPC atomique). */
export function useGenerateContractVisit() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("generate_contract_visit", {
        p_contract_id: contractId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, contractId) => {
      void queryClient.invalidateQueries({ queryKey: ["contracts", company.id] });
      void queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      void queryClient.invalidateQueries({
        queryKey: ["interventions", company.id],
      });
    },
  });
}

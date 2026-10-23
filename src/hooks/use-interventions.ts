"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type {
  Intervention,
  InterventionInsert,
  InterventionUpdate,
} from "@/types/database";

export function useInterventions() {
  const company = useCompany();
  const supabase = createClient();
  return useQuery({
    queryKey: ["interventions", company.id],
    queryFn: async (): Promise<Intervention[]> => {
      const { data, error } = await supabase
        .from("interventions")
        .select("*")
        .eq("company_id", company.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Intervention[];
    },
  });
}

export function useIntervention(id: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["intervention", id],
    queryFn: async (): Promise<Intervention | null> => {
      const { data, error } = await supabase
        .from("interventions")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return (data as Intervention) ?? null;
    },
  });
}

export function useSaveIntervention() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input:
        | { id: string; values: InterventionUpdate }
        | { values: Omit<InterventionInsert, "company_id"> },
    ): Promise<Intervention> => {
      if ("id" in input) {
        const { data, error } = await supabase
          .from("interventions")
          .update(input.values)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data as Intervention;
      }
      const insert: InterventionInsert = {
        ...input.values,
        company_id: company.id,
      };
      const { data, error } = await supabase
        .from("interventions")
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return data as Intervention;
    },
    onSuccess: (row) => {
      void queryClient.invalidateQueries({
        queryKey: ["interventions", company.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["intervention", row.id] });
    },
  });
}

export function useDeleteIntervention() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("interventions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["interventions", company.id],
      });
    },
  });
}

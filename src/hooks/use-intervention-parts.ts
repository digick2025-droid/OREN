"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type { InterventionPart, Part } from "@/types/database";

/** Pièces posées sur une intervention (plus récentes en tête). */
export function useInterventionParts(interventionId: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["intervention-parts", interventionId],
    queryFn: async (): Promise<InterventionPart[]> => {
      const { data, error } = await supabase
        .from("intervention_parts")
        .select("*")
        .eq("intervention_id", interventionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as InterventionPart[];
    },
  });
}

/** Ajoute une pièce (snapshot du magasin) ; le trigger décrémente le stock. */
export function useAddInterventionPart(interventionId: string) {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      part,
      quantity,
    }: {
      part: Part;
      quantity: number;
    }): Promise<InterventionPart> => {
      const { data, error } = await supabase
        .from("intervention_parts")
        .insert({
          company_id: company.id,
          intervention_id: interventionId,
          part_id: part.id,
          name: part.name,
          unit: part.unit,
          unit_price: part.unit_price,
          quantity,
        })
        .select()
        .single();
      if (error) throw error;
      return data as InterventionPart;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["intervention-parts", interventionId],
      });
      void queryClient.invalidateQueries({ queryKey: ["parts", company.id] });
    },
  });
}

/** Retire une pièce posée ; le trigger restitue le stock. */
export function useRemoveInterventionPart(interventionId: string) {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("intervention_parts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["intervention-parts", interventionId],
      });
      void queryClient.invalidateQueries({ queryKey: ["parts", company.id] });
    },
  });
}

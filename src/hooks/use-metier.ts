"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import { CATALOG_TEMPLATES, type Metier } from "@/lib/catalog-templates";
import type { CatalogItemInsert } from "@/types/database";

/**
 * Enregistre le métier de l'entreprise et, si l'offre a la feature `catalog`,
 * pré-remplit le catalogue avec le modèle correspondant.
 *
 * `seedCatalog: false` n'écrit que `companies.metier` : le choix reste
 * réutilisable si l'entreprise passe plus tard sur une offre avec catalogue —
 * le seed se fera alors sans redemander le métier.
 */
export function useSetMetier() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      metier,
      seedCatalog,
    }: {
      metier: Metier;
      seedCatalog: boolean;
    }): Promise<{ seeded: boolean }> => {
      const { error } = await supabase
        .from("companies")
        .update({ metier })
        .eq("id", company.id);
      if (error) throw error;

      const template = CATALOG_TEMPLATES[metier];
      if (!seedCatalog || template.length === 0) return { seeded: false };

      // Un catalogue existant n'est jamais écrasé. Le compte est revérifié ici
      // plutôt que de se fier au cache React Query, qui peut être périmé.
      const { count, error: countError } = await supabase
        .from("catalog_items")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .is("deleted_at", null);
      if (countError) throw countError;
      if ((count ?? 0) > 0) return { seeded: false };

      const rows: CatalogItemInsert[] = template.map((item) => ({
        company_id: company.id,
        name: item.name,
        type: item.type,
        unit: item.unit,
        unit_price: item.unit_price,
      }));
      const { error: insertError } = await supabase
        .from("catalog_items")
        .insert(rows);
      if (insertError) throw insertError;
      return { seeded: true };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", company.id] });
    },
  });
}

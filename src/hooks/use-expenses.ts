"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type { Expense, ExpenseInsert, ExpenseUpdate } from "@/types/database";

/** Bornes du mois (1-based) : [début, début du mois suivant[ en AAAA-MM-JJ. */
export function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  const nextStart = `${ny}-${String(nm).padStart(2, "0")}-01`;
  return { start, nextStart };
}

/** Dépenses d'un mois (expense_date dans le mois). */
export function useExpenses(year: number, month: number) {
  const company = useCompany();
  const supabase = createClient();
  const { start, nextStart } = monthBounds(year, month);
  return useQuery({
    queryKey: ["expenses", company.id, start],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("company_id", company.id)
        .is("deleted_at", null)
        .gte("expense_date", start)
        .lt("expense_date", nextStart)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useSaveExpense() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      values: Omit<ExpenseInsert, "company_id">;
    }): Promise<Expense> => {
      if (input.id) {
        const update: ExpenseUpdate = input.values;
        const { data, error } = await supabase
          .from("expenses")
          .update(update)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data as Expense;
      }
      const insert: ExpenseInsert = { ...input.values, company_id: company.id };
      const { data, error } = await supabase
        .from("expenses")
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["expenses", company.id] });
    },
  });
}

export function useDeleteExpense() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["expenses", company.id] });
    },
  });
}

export interface TreasurySummary {
  /** Factures émises dans le mois (Σ total). */
  billed: number;
  /** Factures payées dans le mois (Σ total). */
  collected: number;
  /** Coût des pièces posées dans le mois (Σ coût × quantité). */
  partsCost: number;
}

/**
 * Revenus & coût pièces du mois, pour la trésorerie. Les dépenses sont
 * agrégées côté page à partir de useExpenses (même liste affichée).
 */
export function useTreasurySummary(year: number, month: number) {
  const company = useCompany();
  const supabase = createClient();
  const { start, nextStart } = monthBounds(year, month);
  return useQuery({
    queryKey: ["treasury-summary", company.id, start],
    queryFn: async (): Promise<TreasurySummary> => {
      const [invoices, parts] = await Promise.all([
        supabase
          .from("documents")
          .select("total, status")
          .eq("company_id", company.id)
          .eq("type", "facture")
          .is("deleted_at", null)
          .gte("issue_date", start)
          .lt("issue_date", nextStart),
        supabase
          .from("intervention_parts")
          .select("unit_price, quantity")
          .eq("company_id", company.id)
          .gte("created_at", start)
          .lt("created_at", nextStart),
      ]);
      if (invoices.error) throw invoices.error;
      if (parts.error) throw parts.error;

      let billed = 0;
      let collected = 0;
      for (const row of (invoices.data ?? []) as {
        total: number;
        status: string;
      }[]) {
        billed += row.total;
        if (row.status === "paye") collected += row.total;
      }
      const partsCost = ((parts.data ?? []) as {
        unit_price: number;
        quantity: number;
      }[]).reduce((sum, p) => sum + p.unit_price * p.quantity, 0);

      return { billed, collected, partsCost };
    },
  });
}

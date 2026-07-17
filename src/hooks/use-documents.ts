"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type {
  CreateDocumentPayload,
  DocumentItem,
  DocumentRow,
  DocumentStatus,
  UpdateDocumentPayload,
} from "@/types/database";

export function useDocuments() {
  const company = useCompany();
  const supabase = createClient();

  return useQuery({
    queryKey: ["documents", company.id],
    queryFn: async (): Promise<DocumentRow[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("company_id", company.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentRow[];
    },
  });
}

export function useDocument(id: string) {
  const company = useCompany();
  const supabase = createClient();

  return useQuery({
    queryKey: ["documents", company.id, id],
    queryFn: async (): Promise<{
      document: DocumentRow;
      items: DocumentItem[];
    }> => {
      const [docResult, itemsResult] = await Promise.all([
        supabase.from("documents").select("*").eq("id", id).single(),
        supabase
          .from("document_items")
          .select("*")
          .eq("document_id", id)
          .is("deleted_at", null)
          .order("position"),
      ]);
      if (docResult.error) throw docResult.error;
      if (itemsResult.error) throw itemsResult.error;
      return {
        document: docResult.data as DocumentRow,
        items: itemsResult.data as DocumentItem[],
      };
    },
  });
}

/** Erreur métier levée par la base (quota, droits…) */
export function isQuotaError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("QUOTA_EXCEEDED")
  );
}

export function useCreateDocument() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: CreateDocumentPayload,
    ): Promise<DocumentRow> => {
      const { data, error } = await supabase.rpc("create_document", {
        p_company_id: company.id,
        p_payload: payload,
      });
      if (error) throw new Error(error.message);
      return data as DocumentRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents", company.id] });
      void queryClient.invalidateQueries({ queryKey: ["usage", company.id] });
    },
  });
}

export function useUpdateDocument() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      payload: UpdateDocumentPayload;
    }): Promise<DocumentRow> => {
      const { data, error } = await supabase.rpc("update_document", {
        p_document_id: input.id,
        p_payload: input.payload,
      });
      if (error) throw new Error(error.message);
      return data as DocumentRow;
    },
    onSuccess: (doc) => {
      void queryClient.invalidateQueries({ queryKey: ["documents", company.id] });
      void queryClient.invalidateQueries({
        queryKey: ["documents", company.id, doc.id],
      });
    },
  });
}

export function useUpdateDocumentStatus() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: DocumentStatus;
    }): Promise<void> => {
      const { error } = await supabase
        .from("documents")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents", company.id] });
    },
  });
}

export function useConvertToInvoice() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string): Promise<DocumentRow> => {
      const { data, error } = await supabase.rpc(
        "convert_document_to_invoice",
        { p_document_id: documentId },
      );
      if (error) throw new Error(error.message);
      return data as DocumentRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents", company.id] });
      void queryClient.invalidateQueries({ queryKey: ["usage", company.id] });
    },
  });
}

export function useDeleteDocument() {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents", company.id] });
    },
  });
}

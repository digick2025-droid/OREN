"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import { prepareTestimonialImage } from "@/lib/upload";
import type {
  InterventionPhoto,
  InterventionPhotoKind,
  InterventionReport,
} from "@/types/database";

const BUCKET = "intervention-photos";
const SIGNED_URL_TTL = 3600; // 1 h

/** Rapport (unique) d'une intervention, ou null s'il n'existe pas encore. */
export function useInterventionReport(interventionId: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["intervention-report", interventionId],
    queryFn: async (): Promise<InterventionReport | null> => {
      const { data, error } = await supabase
        .from("intervention_reports")
        .select("*")
        .eq("intervention_id", interventionId)
        .maybeSingle();
      if (error) throw error;
      return (data as InterventionReport) ?? null;
    },
  });
}

type UpsertFields = Partial<
  Pick<
    InterventionReport,
    "summary" | "photos" | "signature_path" | "signed_by" | "signed_at"
  >
>;

/**
 * Crée ou met à jour le rapport (upsert sur intervention_id). Seules les
 * colonnes fournies sont écrites : les autres gardent leur valeur (ou leur
 * défaut à la création).
 */
export function useSaveReport(interventionId: string) {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fields: UpsertFields): Promise<InterventionReport> => {
      const { data, error } = await supabase
        .from("intervention_reports")
        .upsert(
          {
            company_id: company.id,
            intervention_id: interventionId,
            ...fields,
          },
          { onConflict: "intervention_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as InterventionReport;
    },
    onSuccess: (row) => {
      queryClient.setQueryData(["intervention-report", interventionId], row);
    },
  });
}

async function uploadToBucket(
  file: File | Blob,
  path: string,
  contentType: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: true });
  if (error) throw error;
}

/** Ajoute une photo (avant/après) : compression + upload + maj du rapport. */
export function useAddReportPhoto(interventionId: string) {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      kind,
      current,
    }: {
      file: File;
      kind: InterventionPhotoKind;
      current: InterventionPhoto[];
    }): Promise<InterventionReport> => {
      const prepared = await prepareTestimonialImage(file);
      if (!prepared.ok) throw new Error(prepared.message);
      const safe = prepared.file;
      const ext = safe.name.split(".").pop() ?? "webp";
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${company.id}/${interventionId}/${kind}-${Date.now()}-${rand}.${ext}`;
      await uploadToBucket(safe, path, safe.type);
      const photos = [...current, { path, kind }];
      const { data, error } = await supabase
        .from("intervention_reports")
        .upsert(
          {
            company_id: company.id,
            intervention_id: interventionId,
            photos,
          },
          { onConflict: "intervention_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as InterventionReport;
    },
    onSuccess: (row) => {
      queryClient.setQueryData(["intervention-report", interventionId], row);
    },
  });
}

/** Retire une photo : suppression du fichier + maj du rapport. */
export function useRemoveReportPhoto(interventionId: string) {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      photo,
      current,
    }: {
      photo: InterventionPhoto;
      current: InterventionPhoto[];
    }): Promise<InterventionReport> => {
      await supabase.storage.from(BUCKET).remove([photo.path]);
      const photos = current.filter((p) => p.path !== photo.path);
      const { data, error } = await supabase
        .from("intervention_reports")
        .upsert(
          {
            company_id: company.id,
            intervention_id: interventionId,
            photos,
          },
          { onConflict: "intervention_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as InterventionReport;
    },
    onSuccess: (row) => {
      queryClient.setQueryData(["intervention-report", interventionId], row);
    },
  });
}

/** Enregistre la signature client : upload de l'image + nom + horodatage. */
export function useSaveSignature(interventionId: string) {
  const company = useCompany();
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      blob,
      signedBy,
    }: {
      blob: Blob;
      signedBy: string;
    }): Promise<InterventionReport> => {
      const path = `${company.id}/${interventionId}/signature-${Date.now()}.png`;
      await uploadToBucket(blob, path, "image/png");
      const { data, error } = await supabase
        .from("intervention_reports")
        .upsert(
          {
            company_id: company.id,
            intervention_id: interventionId,
            signature_path: path,
            signed_by: signedBy,
            signed_at: new Date().toISOString(),
          },
          { onConflict: "intervention_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as InterventionReport;
    },
    onSuccess: (row) => {
      queryClient.setQueryData(["intervention-report", interventionId], row);
    },
  });
}

/** URLs signées (1 h) pour les photos + la signature d'un rapport. */
export function useReportMediaUrls(report: InterventionReport | null | undefined) {
  const supabase = createClient();
  const paths = report
    ? [
        ...report.photos.map((p) => p.path),
        ...(report.signature_path ? [report.signature_path] : []),
      ]
    : [];
  return useQuery({
    queryKey: ["intervention-report-urls", report?.id, paths.join("|")],
    enabled: paths.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
      }
      return map;
    },
  });
}

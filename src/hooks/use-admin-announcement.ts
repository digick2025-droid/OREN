"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface AdminAnnouncement {
  id: string;
  message: string;
  level: "info" | "warning";
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

/** Dernière annonce créée (gérée comme un encart unique, pas une liste). */
export function useAdminAnnouncement() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-announcement"],
    queryFn: async (): Promise<AdminAnnouncement | null> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, message, level, is_active, starts_at, ends_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as AdminAnnouncement | null;
    },
  });
}

export interface SaveAnnouncementInput {
  id: string | null;
  message: string;
  level: "info" | "warning";
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export function useSaveAnnouncement() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveAnnouncementInput) => {
      const values = {
        message: input.message,
        level: input.level,
        is_active: input.is_active,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
      };
      const { error } = input.id
        ? await supabase.from("announcements").update(values).eq("id", input.id)
        : await supabase.from("announcements").insert(values);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-announcement"] });
      void queryClient.invalidateQueries({ queryKey: ["active-announcement"] });
    },
  });
}

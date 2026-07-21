"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface Announcement {
  id: string;
  message: string;
  level: "info" | "warning";
}

/** Annonce active du moment (RLS filtre déjà is_active/starts_at/ends_at). */
export function useActiveAnnouncement() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["active-announcement"],
    queryFn: async (): Promise<Announcement | null> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, message, level")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Announcement | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

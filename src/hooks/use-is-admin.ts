"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** Le compte connecté est-il dans `admin_users` (policy `admin_users_select_self`). */
export function useIsAdmin(): boolean {
  const supabase = createClient();

  const { data } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async (): Promise<boolean> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const { data: admin } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return Boolean(admin);
    },
  });

  return data ?? false;
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface AdminUserListItem {
  user_id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  company_id: string | null;
  company_name: string | null;
  company_suspended_at: string | null;
  plan_key: string | null;
  plan_name: string | null;
  subscription_status: string | null;
}

export function useAdminUsers() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<AdminUserListItem[]> => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw new Error(error.message);
      return data as AdminUserListItem[];
    },
  });
}

export function useAdminSetUserBanned() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      userId: string;
      banned: boolean;
      reason: string | null;
    }) => {
      const { error } = await supabase.rpc("admin_set_user_banned", {
        p_user_id: input.userId,
        p_banned: input.banned,
        p_reason: input.reason,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-company-detail"] });
    },
  });
}

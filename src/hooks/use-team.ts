"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import type {
  CompanyInvitation,
  CompanyRole,
  InvitationRole,
  MemberStatus,
} from "@/types/database";

export interface TeamMember {
  user_id: string;
  role: CompanyRole;
  status: MemberStatus;
  full_name: string | null;
  phone: string | null;
  is_owner: boolean;
  created_at: string;
}

export interface MyInvitation {
  id: string;
  company_id: string;
  company_name: string;
  role: InvitationRole;
  created_at: string;
}

/** Membres de l'entreprise courante (RPC, inclut nom/téléphone de profil). */
export function useTeamMembers() {
  const company = useCompany();
  const supabase = createClient();
  return useQuery({
    queryKey: ["team-members", company.id],
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase.rpc("list_company_members", {
        p_company_id: company.id,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as TeamMember[];
    },
  });
}

/** Invitations en attente émises par l'entreprise courante. */
export function usePendingInvitations() {
  const company = useCompany();
  const supabase = createClient();
  return useQuery({
    queryKey: ["team-invitations", company.id],
    queryFn: async (): Promise<CompanyInvitation[]> => {
      const { data, error } = await supabase
        .from("company_invitations")
        .select("*")
        .eq("company_id", company.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as CompanyInvitation[];
    },
  });
}

export function useInviteMember() {
  const company = useCompany();
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      phone: string;
      role: InvitationRole;
      name?: string;
    }) => {
      const { error } = await supabase.rpc("invite_member", {
        p_company_id: company.id,
        p_phone: input.phone,
        p_role: input.role,
        p_name: input.name ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-invitations", company.id] });
      void qc.invalidateQueries({ queryKey: ["team-members", company.id] });
    },
  });
}

export function useSetMemberRole() {
  const company = useCompany();
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; role: CompanyRole }) => {
      const { error } = await supabase.rpc("set_member_role", {
        p_company_id: company.id,
        p_user_id: input.userId,
        p_role: input.role,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-members", company.id] });
    },
  });
}

export function useRemoveMember() {
  const company = useCompany();
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_member", {
        p_company_id: company.id,
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-members", company.id] });
    },
  });
}

/** Invitations reçues par l'utilisateur courant (tous comptes confondus). */
export function useMyInvitations() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["my-invitations"],
    queryFn: async (): Promise<MyInvitation[]> => {
      const { data, error } = await supabase.rpc("list_my_invitations");
      if (error) throw new Error(error.message);
      return (data ?? []) as MyInvitation[];
    },
  });
}

export function useClaimInvitations() {
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("claim_invitations");
      if (error) throw new Error(error.message);
      return (data as number) ?? 0;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-invitations"] });
    },
  });
}

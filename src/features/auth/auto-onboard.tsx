"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Crée automatiquement l'entreprise si l'utilisateur s'est inscrit par email
 * avec confirmation (session absente à l'inscription, métadonnées présentes).
 */
export function AutoOnboard() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function run() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const companyName = user.user_metadata?.company_name as string | undefined;
      const fullName = user.user_metadata?.full_name as string | undefined;
      if (!companyName?.trim()) return;

      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) return;

      const { error } = await supabase.from("companies").insert({
        name: companyName.trim(),
        owner_name: fullName?.trim() || null,
        owner_id: user.id,
        email: user.email ?? null,
      });
      if (error) {
        // Échec silencieux volontaire : le formulaire manuel de /bienvenue
        // (prérempli avec les mêmes métadonnées) reste la voie de secours.
        console.error("[auto-onboard] company insert failed:", error);
        return;
      }
      router.replace("/accueil");
      router.refresh();
    }

    void run();
  }, [router]);

  return null;
}
